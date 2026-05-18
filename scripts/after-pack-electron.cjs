const path = require('node:path')
const { patchPackagedNodePty } = require('./patch-node-pty-helper.cjs')

exports.default = async function afterPack(context) {
  const resourcesPath = path.join(
    context.appOutDir,
    process.platform === 'darwin'
      ? `${context.packager.appInfo.productFilename}.app/Contents/Resources`
      : 'resources',
  )

  const result = patchPackagedNodePty(resourcesPath)
  console.log(
    `Patched packaged node-pty helper resolution at ${result.unixTerminalPath}; executable helpers: ${result.executableHelpers.length}`,
  )
}
