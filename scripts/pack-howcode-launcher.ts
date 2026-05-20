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
  throw new Error(
    'Usage: bun scripts/pack-howcode-launcher.ts <main|dev> [pack|publish|publish-dry-run]',
  )
}

if (command !== 'pack' && command !== 'publish' && command !== 'publish-dry-run') {
  throw new Error(`Unsupported launcher package command: ${command}`)
}

const repoRoot = process.cwd()
const sourceDirectory = path.join(repoRoot, 'packages', 'howcode')
const tempRoot = await mkdtemp(path.join(os.tmpdir(), `howcode-launcher-${channel}-`))
const packageDirectory = path.join(tempRoot, 'package')
const npmTag = channel === 'dev' ? 'dev' : 'latest'

function runNpm(args: string[]) {
  const result = spawnSync('npm', args, { cwd: packageDirectory, stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed with status ${result.status}`)
  }
}

try {
  await cp(sourceDirectory, packageDirectory, { recursive: true })

  const packageJsonPath = path.join(packageDirectory, 'package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    version?: string
    howcode?: Record<string, unknown>
  }

  if (versionOverride) {
    packageJson.version = versionOverride
  }

  packageJson.howcode = {
    ...packageJson.howcode,
    releaseChannel: channel,
    releaseBaseUrl: `https://github.com/IgorWarzocha/howcode/releases/download/channel-${channel}`,
  }

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
