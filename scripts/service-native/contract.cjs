const path = require('node:path')
const contract = require('../../shared/service-native-abi.json')

function getUnpackedAppPath(resourcesPath) {
  return path.join(resourcesPath, 'app.asar.unpacked')
}

function getAbiBundleRoot(resourcesPath, abi = process.versions.modules) {
  return path.join(
    getUnpackedAppPath(resourcesPath),
    contract.nativeServiceAbiDirectoryName,
    String(abi),
  )
}

module.exports = {
  ...contract,
  requiredNativeRuntimeFiles: contract.requiredNativeRuntimeFiles || contract.nativeRuntimeFiles,
  getUnpackedAppPath,
  getAbiBundleRoot,
}
