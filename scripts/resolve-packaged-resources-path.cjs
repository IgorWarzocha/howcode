#!/usr/bin/env node
const { existsSync, readdirSync, statSync } = require('node:fs')
const path = require('node:path')

const electronOutputRoot = path.join(process.cwd(), 'artifacts', 'electron')
const appName = 'howcode'
const unpackedDirectoryPattern = /unpacked$/i

function walkDirectories(root) {
  const stack = [root]
  const directories = []
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    directories.push(current)
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(path.join(current, entry.name))
    }
  }
  return directories
}

function getCandidateResourcesPaths() {
  if (!existsSync(electronOutputRoot)) return []
  if (process.platform === 'darwin') {
    return walkDirectories(electronOutputRoot)
      .filter((entryPath) => entryPath.endsWith(`${appName}.app`))
      .map((appPath) => path.join(appPath, 'Contents', 'Resources'))
  }

  return walkDirectories(electronOutputRoot)
    .filter((entryPath) => unpackedDirectoryPattern.test(path.basename(entryPath)))
    .map((bundlePath) => path.join(bundlePath, 'resources'))
}

const candidates = getCandidateResourcesPaths().filter(
  (resourcesPath) =>
    existsSync(path.join(resourcesPath, 'app.asar')) ||
    existsSync(path.join(resourcesPath, 'app', 'package.json')),
)

if (candidates.length === 0) {
  console.error(
    'Could not find packaged Electron resources path. Run `bun run build:release` first.',
  )
  process.exit(1)
}

candidates.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
console.log(candidates[0])
