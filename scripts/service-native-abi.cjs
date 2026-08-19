const { spawnSync } = require('node:child_process')
const {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  nativeServiceAbiDirectoryName,
  serviceAbiPackages,
  serviceNativePackages,
  supportedServiceNodeAbis,
  supportedServiceNodeMajors,
} = require('./service-native/contract.cjs')
const {
  getNpmExecutable,
  getPlatformNativeRuntimeFiles,
  getPtyValidationScript,
  getRequiredNativeRuntimeFiles,
  shouldUseShellForNpmInstall,
} = require('./service-native/platform.cjs')

function getUnpackedAppPath(resourcesPath) {
  return path.join(resourcesPath, 'app.asar.unpacked')
}

function getAbiBundleRoot(resourcesPath, abi = process.versions.modules) {
  return path.join(getUnpackedAppPath(resourcesPath), nativeServiceAbiDirectoryName, String(abi))
}

function validateServiceNativeInstallResult(result, npmExecutable, packageNames) {
  if (result.error) {
    throw new Error(
      `Failed to run ${npmExecutable} for service native dependencies: ${result.error.message}`,
    )
  }
  if (result.signal) {
    throw new Error(
      `Service native dependency install was terminated by ${result.signal}: ${packageNames.join(', ')}.`,
    )
  }
  if (result.status !== 0) {
    console.warn(
      `Service native dependency install exited with ${result.status}; checking required built files before failing.`,
    )
  }
}

function rebuildServiceNativeDependencies(resourcesPath, packageNames = serviceNativePackages) {
  const unpackedAppPath = getUnpackedAppPath(resourcesPath)
  if (!existsSync(unpackedAppPath)) {
    console.warn(`Skipping service native rebuild: ${unpackedAppPath} does not exist.`)
    return false
  }

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'howcode-service-native-'))
  try {
    const dependencies = Object.fromEntries(
      packageNames.map((packageName) => {
        const packageJson = JSON.parse(
          readFileSync(
            path.join(unpackedAppPath, 'node_modules', packageName, 'package.json'),
            'utf8',
          ),
        )
        return [packageName, packageJson.version]
      }),
    )
    writeFileSync(
      path.join(tempRoot, 'package.json'),
      `${JSON.stringify({ private: true, dependencies }, null, 2)}\n`,
    )

    const npmExecutable = getNpmExecutable()
    const result = spawnSync(npmExecutable, ['install', '--no-audit', '--no-fund'], {
      cwd: tempRoot,
      env: {
        ...process.env,
        PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}`,
      },
      shell: shouldUseShellForNpmInstall(),
      stdio: 'inherit',
    })

    validateServiceNativeInstallResult(result, npmExecutable, packageNames)

    for (const packageName of packageNames) {
      const sourcePackagePath = path.join(tempRoot, 'node_modules', packageName)
      const destinationPackagePath = path.join(unpackedAppPath, 'node_modules', packageName)
      if (!existsSync(sourcePackagePath)) {
        throw new Error(`Missing installed service native package: ${sourcePackagePath}`)
      }
      rmSync(destinationPackagePath, { recursive: true, force: true })
      mkdirSync(path.dirname(destinationPackagePath), { recursive: true })
      cpSync(sourcePackagePath, destinationPackagePath, { recursive: true })
    }

    for (const relativePath of getPlatformNativeRuntimeFiles()) {
      const sourcePath = path.join(tempRoot, relativePath)
      const destinationPath = path.join(unpackedAppPath, relativePath)
      if (!existsSync(sourcePath)) {
        if (getRequiredNativeRuntimeFiles().includes(relativePath)) {
          throw new Error(`Missing built native dependency: ${sourcePath}`)
        }
        continue
      }
      mkdirSync(path.dirname(destinationPath), { recursive: true })
      copyFileSync(sourcePath, destinationPath)
    }

    return true
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

function copyCurrentNativeDependenciesToAbiBundle(resourcesPath, abi = process.versions.modules) {
  const unpackedAppPath = getUnpackedAppPath(resourcesPath)
  const abiBundleRoot = getAbiBundleRoot(resourcesPath, abi)
  rmSync(abiBundleRoot, { recursive: true, force: true })

  for (const packageName of serviceAbiPackages) {
    const sourcePackagePath = path.join(unpackedAppPath, 'node_modules', packageName)
    const destinationPackagePath = path.join(abiBundleRoot, 'node_modules', packageName)
    if (!existsSync(sourcePackagePath)) {
      throw new Error(`Missing rebuilt native package: ${sourcePackagePath}`)
    }
    rmSync(destinationPackagePath, { recursive: true, force: true })
    mkdirSync(path.dirname(destinationPackagePath), { recursive: true })
    cpSync(sourcePackagePath, destinationPackagePath, { recursive: true })
  }

  const copiedFiles = []
  for (const relativePath of getPlatformNativeRuntimeFiles()) {
    const sourcePath = path.join(unpackedAppPath, relativePath)
    const destinationPath = path.join(abiBundleRoot, relativePath)
    if (!existsSync(sourcePath)) {
      if (getRequiredNativeRuntimeFiles().includes(relativePath)) {
        throw new Error(`Missing rebuilt native dependency: ${sourcePath}`)
      }
      continue
    }
    mkdirSync(path.dirname(destinationPath), { recursive: true })
    copyFileSync(sourcePath, destinationPath)
    copiedFiles.push(relativePath)
  }

  writeFileSync(
    path.join(abiBundleRoot, 'manifest.json'),
    `${JSON.stringify(
      {
        abi: String(abi),
        nodeVersion: process.version,
        packages: serviceAbiPackages,
        files: copiedFiles,
      },
      null,
      2,
    )}\n`,
  )

  return abiBundleRoot
}

function probeNodeAbi(nodeExecutable) {
  const result = spawnSync(nodeExecutable, ['-p', 'process.versions.modules'], {
    encoding: 'utf8',
  })
  if (result.error || result.signal || result.status !== 0) {
    const stdout = result.stdout?.trim() || ''
    const stderr = result.stderr?.trim() || ''
    throw new Error(
      [
        `Failed to probe Node ABI for ${nodeExecutable}.`,
        result.error ? `error: ${result.error.message}` : '',
        result.signal ? `signal: ${result.signal}` : '',
        stdout,
        stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
  return result.stdout.trim()
}

function getNativeValidationScript() {
  return `
    const betterSqlite3 = require('better-sqlite3')
    const Database = betterSqlite3.default || betterSqlite3
    const db = new Database(':memory:')
    db.prepare('select 1').get()
    db.close()

    const nodePty = require('node-pty')
    ${getPtyValidationScript()}
    setTimeout(() => pty.kill(), 2000).unref?.()
    pty.onExit(() => process.exit(0))
  `
}

function validateCurrentNativeDependenciesLoad(resourcesPath, nodeExecutable = process.execPath) {
  const unpackedAppPath = getUnpackedAppPath(resourcesPath)
  const abi = probeNodeAbi(nodeExecutable)
  const abiBundleRoot = getAbiBundleRoot(resourcesPath, abi)
  validateAbiBundle(resourcesPath, abi)

  const result = spawnSync(nodeExecutable, ['-e', getNativeValidationScript()], {
    cwd: abiBundleRoot,
    env: {
      ...process.env,
      NODE_PATH: [
        path.join(abiBundleRoot, 'node_modules'),
        path.join(unpackedAppPath, 'node_modules'),
      ].join(path.delimiter),
    },
    encoding: 'utf8',
    timeout: 10_000,
  })

  if (result.error || result.signal || result.status !== 0) {
    const stdout = result.stdout?.trim() || ''
    const stderr = result.stderr?.trim() || ''
    throw new Error(
      [
        `Packaged native service dependency bundle for ABI ${abi} does not load under stock Node ${nodeExecutable}.`,
        result.error ? `error: ${result.error.message}` : '',
        result.signal ? `signal: ${result.signal}` : '',
        stdout,
        stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
}

function listPackagedAbiBundles(resourcesPath) {
  const root = path.join(getUnpackedAppPath(resourcesPath), nativeServiceAbiDirectoryName)
  if (!existsSync(root)) return []
  return supportedServiceNodeAbis.filter((abi) => existsSync(path.join(root, abi, 'manifest.json')))
}

function readAbiManifest(resourcesPath, abi) {
  const manifestPath = path.join(getAbiBundleRoot(resourcesPath, abi), 'manifest.json')
  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

function assertManifestFileExists(abiBundleRoot, abi, relativePath) {
  const filePath = path.join(abiBundleRoot, relativePath)
  if (!existsSync(filePath)) {
    throw new Error(`Missing service native dependency for Node ABI ${abi}: ${filePath}`)
  }
}

function validateAbiManifestFiles(abiBundleRoot, abi, manifestPath, manifestFiles) {
  for (const relativePath of getRequiredNativeRuntimeFiles()) {
    if (!manifestFiles.includes(relativePath)) {
      throw new Error(`Service native ABI manifest ${manifestPath} is missing ${relativePath}.`)
    }
    assertManifestFileExists(abiBundleRoot, abi, relativePath)
  }

  for (const relativePath of manifestFiles) {
    if (!getPlatformNativeRuntimeFiles().includes(relativePath)) {
      throw new Error(
        `Service native ABI manifest ${manifestPath} lists unexpected file ${relativePath}.`,
      )
    }
    assertManifestFileExists(abiBundleRoot, abi, relativePath)
  }
}

function validateAbiBundle(resourcesPath, abi) {
  const abiBundleRoot = getAbiBundleRoot(resourcesPath, abi)
  const manifestPath = path.join(abiBundleRoot, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing service native ABI manifest for Node ABI ${abi}: ${manifestPath}`)
  }

  const manifest = readAbiManifest(resourcesPath, abi)
  if (manifest.abi !== String(abi)) {
    throw new Error(`Service native ABI manifest mismatch at ${manifestPath}: expected ${abi}.`)
  }

  const manifestFiles = Array.isArray(manifest.files) ? manifest.files : []
  validateAbiManifestFiles(abiBundleRoot, abi, manifestPath, manifestFiles)

  for (const packageName of serviceAbiPackages) {
    const packageJsonPath = path.join(abiBundleRoot, 'node_modules', packageName, 'package.json')
    if (!existsSync(packageJsonPath)) {
      throw new Error(
        `Missing service native package manifest for Node ABI ${abi}: ${packageJsonPath}`,
      )
    }
  }
}

module.exports = {
  getPlatformNativeRuntimeFiles,
  getRequiredNativeRuntimeFiles,
  nativeServiceAbiDirectoryName,
  serviceAbiPackages,
  serviceNativePackages,
  supportedServiceNodeMajors,
  supportedServiceNodeAbis,
  copyCurrentNativeDependenciesToAbiBundle,
  getAbiBundleRoot,
  getUnpackedAppPath,
  listPackagedAbiBundles,
  readAbiManifest,
  rebuildServiceNativeDependencies,
  validateAbiBundle,
  validateCurrentNativeDependenciesLoad,
}
