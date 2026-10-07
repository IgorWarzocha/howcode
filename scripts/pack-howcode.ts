import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

type Channel = 'main' | 'dev'
type Command = 'pack' | 'publish' | 'publish-dry-run'

const channel = process.argv[2] as Channel | undefined
const command = (process.argv[3] ?? 'pack') as Command
const versionOverride = process.argv[4]

if (channel !== 'main' && channel !== 'dev') {
  throw new Error('Usage: bun scripts/pack-howcode.ts <main|dev> [pack|publish|publish-dry-run]')
}

if (command !== 'pack' && command !== 'publish' && command !== 'publish-dry-run') {
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
const tempRoot = await mkdtemp(path.join(os.tmpdir(), `howcode-package-${channel}-`))
const packageDirectory = path.join(tempRoot, 'package')
const npmTag = channel === 'dev' ? 'dev' : 'latest'

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
  await cp(sourceDirectory, packageDirectory, { recursive: true })
  await cp(rendererRoot, path.join(packageDirectory, 'dist'), { recursive: true })
  for (const directory of ['server', 'desktop', 'resources']) {
    await cp(path.join(buildRoot, directory), path.join(packageDirectory, 'build', directory), {
      recursive: true,
    })
  }

  const rootPackage = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
    engines: { node: string }
  }

  const packageJsonPath = path.join(packageDirectory, 'package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    version?: string
    dependencies: Record<string, string>
    engines: { node: string }
  }

  if (versionOverride) {
    packageJson.version = versionOverride
  }

  packageJson.dependencies = Object.fromEntries(
    Object.keys(packageJson.dependencies).map((name) => {
      const version = rootPackage.dependencies[name]
      if (!version) throw new Error(`Missing runtime dependency: ${name}`)
      return [name, version]
    }),
  )
  packageJson.engines = rootPackage.engines

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

  if (command === 'pack') {
    const artifactDirectory = path.join(repoRoot, 'artifacts')
    await mkdir(artifactDirectory, { recursive: true })
    runNpm(['pack', '--pack-destination', artifactDirectory])
  } else if (command === 'publish-dry-run') {
    runNpm(['publish', '--dry-run', '--tag', npmTag])
  } else {
    runNpm(['publish', '--tag', npmTag])
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
