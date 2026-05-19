const path = require('node:path')
const { patchPackagedNodePty } = require('./patch-node-pty-helper.cjs')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'win32') return

  const resourcesPath =
    context.electronPlatformName === 'darwin'
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app/Contents/Resources`,
        )
      : path.join(context.appOutDir, 'resources')

  const result = patchPackagedNodePty(resourcesPath)
  console.log(
    `Patched packaged node-pty helper resolution at ${result.unixTerminalPath}; executable helpers: ${result.executableHelpers.length}`,
  )
}
