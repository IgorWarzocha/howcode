const betterSqliteFile = 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'

function nativeRuntimeFiles() {
  return [betterSqliteFile, 'node_modules/node-pty/build/Release/pty.node']
}

function requiredNativeRuntimeFiles() {
  return [betterSqliteFile]
}

function ptyValidationScript() {
  return `
      const pty = nodePty.spawn('/bin/sh', ['-lc', 'exit 0'], {
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env,
      })
    `
}

module.exports = {
  nativeRuntimeFiles,
  npmExecutable: () => 'npm',
  patchNodePty: true,
  ptyValidationScript,
  requiredNativeRuntimeFiles,
}
