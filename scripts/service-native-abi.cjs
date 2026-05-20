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
  nativeRuntimeFiles,
  serviceNativePackages,
  supportedServiceNodeAbis,
  supportedServiceNodeMajors,
} = require('../shared/service-native-abi.json')

function getUnpackedAppPath(resourcesPath) {
  return path.join(resourcesPath, 'app.asar.unpacked')
}

function getAbiBundleRoot(resourcesPath, abi = process.versions.modules) {
  return path.join(getUnpackedAppPath(resourcesPath), nativeServiceAbiDirectoryName, String(abi))
}

function rebuildServiceNativeDependencies(resourcesPath) {
  const unpackedAppPath = getUnpackedAppPath(resourcesPath)
  if (!existsSync(unpackedAppPath)) {
    console.warn(`Skipping service native rebuild: ${unpackedAppPath} does not exist.`)
    return false
  }

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'howcode-service-native-'))
  try {
    const dependencies = Object.fromEntries(
      serviceNativePackages.map((packageName) => {
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

    const result = spawnSync('npm', ['install', '--build-from-source', '--no-audit', '--no-fund'], {
      cwd: tempRoot,
      env: {
        ...process.env,
        PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}`,
        npm_config_runtime: 'node',
        npm_config_target: process.versions.node,
        npm_config_disturl: 'https://nodejs.org/download/release',
      },
      stdio: 'inherit',
    })

    if (result.status !== 0) {
      throw new Error(
        `Failed to build service native dependencies for stock Node: ${serviceNativePackages.join(', ')}.`,
      )
    }

    for (const relativePath of nativeRuntimeFiles) {
      const sourcePath = path.join(tempRoot, relativePath)
      const destinationPath = path.join(unpackedAppPath, relativePath)
      if (!existsSync(sourcePath)) {
        throw new Error(`Missing built native dependency: ${sourcePath}`)
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

  for (const packageName of serviceNativePackages) {
    const sourcePackagePath = path.join(unpackedAppPath, 'node_modules', packageName)
    const destinationPackagePath = path.join(abiBundleRoot, 'node_modules', packageName)
    if (!existsSync(sourcePackagePath)) {
      throw new Error(`Missing rebuilt native package: ${sourcePackagePath}`)
    }
    rmSync(destinationPackagePath, { recursive: true, force: true })
    mkdirSync(path.dirname(destinationPackagePath), { recursive: true })
    cpSync(sourcePackagePath, destinationPackagePath, { recursive: true })
  }

  for (const relativePath of nativeRuntimeFiles) {
    const sourcePath = path.join(unpackedAppPath, relativePath)
    const destinationPath = path.join(abiBundleRoot, relativePath)
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing rebuilt native dependency: ${sourcePath}`)
    }
    mkdirSync(path.dirname(destinationPath), { recursive: true })
    copyFileSync(sourcePath, destinationPath)
  }

  writeFileSync(
    path.join(abiBundleRoot, 'manifest.json'),
    `${JSON.stringify(
      {
        abi: String(abi),
        nodeVersion: process.version,
        packages: serviceNativePackages,
        files: nativeRuntimeFiles,
      },
      null,
      2,
    )}\n`,
  )

  return abiBundleRoot
}

function validateCurrentNativeDependenciesLoad(resourcesPath) {
  const unpackedAppPath = getUnpackedAppPath(resourcesPath)
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `
        for (const packageName of ${JSON.stringify(serviceNativePackages)}) {
          require(packageName)
        }
      `,
    ],
    {
      cwd: unpackedAppPath,
      env: {
        ...process.env,
        NODE_PATH: path.join(unpackedAppPath, 'node_modules'),
      },
      encoding: 'utf8',
    },
  )

  if (result.status !== 0) {
    throw new Error(
      [
        `Packaged native service dependencies do not load under stock Node ${process.version} (ABI ${process.versions.modules}).`,
        result.stdout.trim(),
        result.stderr.trim(),
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
  for (const relativePath of nativeRuntimeFiles) {
    if (!manifestFiles.includes(relativePath)) {
      throw new Error(`Service native ABI manifest ${manifestPath} is missing ${relativePath}.`)
    }
    const filePath = path.join(abiBundleRoot, relativePath)
    if (!existsSync(filePath)) {
      throw new Error(`Missing service native dependency for Node ABI ${abi}: ${filePath}`)
    }
  }

  for (const packageName of serviceNativePackages) {
    const packageJsonPath = path.join(abiBundleRoot, 'node_modules', packageName, 'package.json')
    if (!existsSync(packageJsonPath)) {
      throw new Error(
        `Missing service native package manifest for Node ABI ${abi}: ${packageJsonPath}`,
      )
    }
  }
}

module.exports = {
  nativeRuntimeFiles,
  nativeServiceAbiDirectoryName,
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
