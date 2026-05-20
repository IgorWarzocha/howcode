#!/usr/bin/env node
const { spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')
const { supportedServiceNodeMajors } = require('./service-native-abi.cjs')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...options })
  if (result.status === 0) return true
  if (result.error && options.optional) return false
  if (options.optional) return false
  process.exit(result.status || 1)
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0) return null
  return result.stdout.trim()
}

function currentNodeMajor() {
  return process.versions.node.split('.')[0]
}

function envNodePathForMajor(major) {
  return process.env[`HOWCODE_NODE_${major}_PATH`] || process.env[`NODE_${major}_PATH`] || ''
}

function resolveMiseNode(major) {
  const output = capture('mise', ['which', `node@${major}`])
  return output && existsSync(output) ? output : null
}

function runBundleBuilderWithNode(nodeExecutable, targetResourcesPath) {
  return run(nodeExecutable, [
    path.join(__dirname, 'build-service-native-abi-bundle.cjs'),
    targetResourcesPath,
  ])
}

function buildReleaseServiceNativeAbiBundles(resourcesPath) {
  for (const major of supportedServiceNodeMajors) {
    if (currentNodeMajor() === major) {
      runBundleBuilderWithNode(process.execPath, resourcesPath)
      continue
    }

    const envNodePath = envNodePathForMajor(major)
    if (envNodePath) {
      runBundleBuilderWithNode(envNodePath, resourcesPath)
      continue
    }

    const miseNodePath = resolveMiseNode(major)
    if (miseNodePath) {
      runBundleBuilderWithNode(miseNodePath, resourcesPath)
      continue
    }

    console.error(
      `Missing Node ${major} for service native ABI bundle. Install it with mise, or set HOWCODE_NODE_${major}_PATH to an absolute node executable.`,
    )
    process.exit(1)
  }
}

function resolveDefaultResourcesPath() {
  return capture(process.execPath, [path.join(__dirname, 'resolve-packaged-resources-path.cjs')])
}

if (require.main === module) {
  const resourcesPath = process.argv[2] || resolveDefaultResourcesPath()

  if (!resourcesPath) {
    console.error('Could not resolve packaged resources path. Run `bun run build:release` first.')
    process.exit(1)
  }

  buildReleaseServiceNativeAbiBundles(resourcesPath)
}

module.exports = { buildReleaseServiceNativeAbiBundles }
