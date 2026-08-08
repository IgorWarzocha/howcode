function getBetterSqlitePrebuildFile(platform = process.platform, arch = process.arch) {
  const targetPlatform = platform === 'linux' ? 'linux' : platform
  return `node_modules/better-sqlite3/prebuilds/${targetPlatform}-${arch}.node`
}

module.exports = { getBetterSqlitePrebuildFile }
