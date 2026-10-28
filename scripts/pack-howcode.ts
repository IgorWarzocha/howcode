import { spawnSync } from 'node:child_process'
import { constants, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { releaseDependencies, releaseVersion } from './howcode-release'

type Channel = 'main' | 'dev' | 'durable'
type Command = 'preflight' | 'pack' | 'publish' | 'publish-dry-run'

const channel = process.argv[2] as Channel | undefined
const command = (process.argv[3] ?? 'pack') as Command
const versionOverride = process.argv[4]

if (channel !== 'main' && channel !== 'dev' && channel !== 'durable') {
  throw new Error(
    'Usage: bun scripts/pack-howcode.ts <main|dev|durable> [preflight|pack|publish|publish-dry-run] [version]',
  )
}

if (
  command !== 'preflight' &&
  command !== 'pack' &&
  command !== 'publish' &&
  command !== 'publish-dry-run'
) {
  throw new Error(`Unsupported package command: ${command}`)
}

const repoRoot = process.cwd()
const buildRoot = path.resolve(
  getEnvironmentVariable('HOWCODE_BUILD_ROOT') || path.join(repoRoot, 'build'),
)
const rendererRoot = path.resolve(
  getEnvironmentVariable('HOWCODE_RENDERER_ROOT') || path.join(repoRoot, 'dist'),
)
const sourceDirectory = path.join(repoRoot, 'packages', 'howcode')
const npmTag = channel === 'main' ? 'latest' : channel
const rootPackage = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
  engines: { node: string }
  howcodeComponents: string[]
}
const packageJson = JSON.parse(
  await readFile(path.join(sourceDirectory, 'package.json'), 'utf8'),
) as {
  version: string
  dependencies: Record<string, string>
  engines: { node: string }
}
packageJson.version = releaseVersion(channel, packageJson.version, versionOverride)
packageJson.dependencies = releaseDependencies(
  packageJson.dependencies,
  rootPackage.dependencies,
  rootPackage.howcodeComponents,
)
packageJson.engines = rootPackage.engines
if (command === 'preflight') {
  console.log(`Release manifest ready: howcode@${packageJson.version} (${npmTag})`)
  process.exit(0)
}
const artifactDirectory = path.join(repoRoot, 'artifacts')
const artifactPath = path.join(artifactDirectory, `howcode-${packageJson.version}.tgz`)
const tempRoot = await mkdtemp(path.join(os.tmpdir(), `howcode-package-${channel}-`))
const packageDirectory = path.join(tempRoot, 'package')

function getEnvironmentVariable(name: string) {
  return process.env[name]
}

function runNpm(args: string[]) {
  const result = spawnSync('npm', args, { cwd: packageDirectory, stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed with status ${result.status}`)
  }
}

try {
  await mkdir(packageDirectory)
  for (const entry of ['bin', 'README.md', 'LICENSE']) {
    await cp(path.join(sourceDirectory, entry), path.join(packageDirectory, entry), {
      recursive: true,
    })
  }
  await cp(rendererRoot, path.join(packageDirectory, 'dist'), { recursive: true })
  for (const directory of ['server', 'desktop', 'resources']) {
    await cp(path.join(buildRoot, directory), path.join(packageDirectory, 'build', directory), {
      recursive: true,
    })
  }

  const packageJsonPath = path.join(packageDirectory, 'package.json')
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

  if (command === 'pack') {
    await mkdir(artifactDirectory, { recursive: true })
    runNpm(['pack', '--pack-destination', tempRoot, '--ignore-scripts'])
    // COPYFILE_EXCL makes repeat local runs fail instead of replacing an existing artifact.
    await copyFile(
      path.join(tempRoot, path.basename(artifactPath)),
      artifactPath,
      constants.COPYFILE_EXCL,
    )
  } else if (command === 'publish-dry-run') {
    runNpm(['publish', '--dry-run', '--tag', npmTag, '--ignore-scripts'])
  } else {
    runNpm(['publish', '--tag', npmTag, '--ignore-scripts', '--access', 'public'])
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
