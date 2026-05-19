const fs = require('node:fs')
const path = require('node:path')

const NODE_PTY_UNIX_TERMINAL_PATTERN = `var helperPath = native.dir + '/spawn-helper';
helperPath = path.resolve(__dirname, helperPath);
helperPath = helperPath.replace('app.asar', 'app.asar.unpacked');
helperPath = helperPath.replace('node_modules.asar', 'node_modules.asar.unpacked');`

const NODE_PTY_UNIX_TERMINAL_REPLACEMENT = `var helperPath = native.dir + '/spawn-helper';
helperPath = path.resolve(__dirname, helperPath);
function unpackAsarPath(value, marker) {
    var unpacked = marker + '.unpacked';
    return value.indexOf(unpacked) !== -1 ? value : value.replace(marker, unpacked);
}
helperPath = unpackAsarPath(helperPath, 'app.asar');
helperPath = unpackAsarPath(helperPath, 'node_modules.asar');`

function unpackAsarPath(value, marker) {
  const unpacked = `${marker}.unpacked`
  return value.includes(unpacked) ? value : value.replace(marker, unpacked)
}

function resolveNodePtyRoot(resourcesPath) {
  return path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'node-pty')
}

function patchUnixTerminal(unixTerminalPath) {
  const source = fs.readFileSync(unixTerminalPath, 'utf8')
  if (source.includes('function unpackAsarPath(value, marker)')) {
    return { patched: false, reason: 'already-patched' }
  }

  if (!source.includes(NODE_PTY_UNIX_TERMINAL_PATTERN)) {
    throw new Error(`node-pty helperPath pattern not found in ${unixTerminalPath}`)
  }

  fs.writeFileSync(
    unixTerminalPath,
    source.replace(NODE_PTY_UNIX_TERMINAL_PATTERN, NODE_PTY_UNIX_TERMINAL_REPLACEMENT),
  )
  return { patched: true }
}

function chmodExecutableIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return false
  fs.chmodSync(filePath, 0o755)
  return true
}

function getNodePtySpawnHelperCandidates(nodePtyRoot) {
  return [
    path.join(nodePtyRoot, 'build', 'Release', 'spawn-helper'),
    path.join(nodePtyRoot, 'prebuilds', 'darwin-arm64', 'spawn-helper'),
    path.join(nodePtyRoot, 'prebuilds', 'darwin-x64', 'spawn-helper'),
  ]
}

function ensureNodePtySpawnHelpersExecutable(nodePtyRoot) {
  return getNodePtySpawnHelperCandidates(nodePtyRoot).filter(chmodExecutableIfPresent)
}

function patchPackagedNodePty(resourcesPath, options = {}) {
  const nodePtyRoot = resolveNodePtyRoot(resourcesPath)
  const unixTerminalPath = path.join(nodePtyRoot, 'lib', 'unixTerminal.js')
  const helperCandidates = getNodePtySpawnHelperCandidates(nodePtyRoot)
  const existingHelpers = helperCandidates.filter((candidate) => fs.existsSync(candidate))

  if (!fs.existsSync(unixTerminalPath)) {
    if (options.optional) {
      return {
        nodePtyRoot,
        unixTerminalPath,
        patchResult: { patched: false, reason: 'missing-unix-terminal' },
        executableHelpers: [],
      }
    }
    throw new Error(`Packaged node-pty unixTerminal.js not found: ${unixTerminalPath}`)
  }
  if (existingHelpers.length === 0) {
    if (options.optional) {
      return {
        nodePtyRoot,
        unixTerminalPath,
        patchResult: { patched: false, reason: 'missing-spawn-helper' },
        executableHelpers: [],
      }
    }
    throw new Error(`Packaged node-pty spawn-helper not found under: ${nodePtyRoot}`)
  }

  const patchResult = patchUnixTerminal(unixTerminalPath)
  const executableHelpers = existingHelpers.filter(chmodExecutableIfPresent)

  return {
    nodePtyRoot,
    unixTerminalPath,
    patchResult,
    executableHelpers,
  }
}

module.exports = {
  NODE_PTY_UNIX_TERMINAL_PATTERN,
  NODE_PTY_UNIX_TERMINAL_REPLACEMENT,
  unpackAsarPath,
  patchUnixTerminal,
  getNodePtySpawnHelperCandidates,
  ensureNodePtySpawnHelpersExecutable,
  patchPackagedNodePty,
}
