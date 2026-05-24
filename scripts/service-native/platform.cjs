const path = require('node:path')

function loadPlatformAdapter(platform = process.platform) {
  if (platform === 'darwin') return require('./platforms/darwin.cjs')
  if (platform === 'win32') return require('./platforms/win32.cjs')
  return require('./platforms/linux.cjs')
}

function getNpmExecutable(platform = process.platform) {
  return loadPlatformAdapter(platform).npmExecutable()
}

function getPlatformNativeRuntimeFiles(platform = process.platform, arch = process.arch) {
  return loadPlatformAdapter(platform).nativeRuntimeFiles(arch)
}

function getRequiredNativeRuntimeFiles(platform = process.platform) {
  return loadPlatformAdapter(platform).requiredNativeRuntimeFiles()
}

function getPtyValidationScript(platform = process.platform) {
  return loadPlatformAdapter(platform).ptyValidationScript()
}

function shouldUseShellForNpmInstall(platform = process.platform) {
  return Boolean(loadPlatformAdapter(platform).useShellForNpmInstall)
}

function getPatchableNodePtyRoots(bundleRoot, platform = process.platform) {
  if (!loadPlatformAdapter(platform).patchNodePty) return []
  return [path.join(bundleRoot, 'node_modules', 'node-pty')]
}

module.exports = {
  getNpmExecutable,
  getPatchableNodePtyRoots,
  getPlatformNativeRuntimeFiles,
  getPtyValidationScript,
  getRequiredNativeRuntimeFiles,
  shouldUseShellForNpmInstall,
}
