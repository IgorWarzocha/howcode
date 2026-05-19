const path = require('node:path')
const { patchPackagedNodePty } = require('./patch-node-pty-helper.cjs')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const resourcesPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app/Contents/Resources`,
  )

  const result = patchPackagedNodePty(resourcesPath)
  console.log(
    `Patched packaged node-pty helper resolution at ${result.unixTerminalPath}; executable helpers: ${result.executableHelpers.length}`,
  )
}
