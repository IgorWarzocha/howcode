function unique(values) {
  return [...new Set(values)]
}

function nativeRuntimeFiles(arch = process.arch) {
  const arches = unique([arch, 'x64', 'arm64'])
  return [
    'node_modules/node-pty/build/Release/pty.node',
    'node_modules/node-pty/build/Release/conpty.node',
    'node_modules/node-pty/build/Release/conpty_console_list.node',
    'node_modules/node-pty/build/Release/winpty.dll',
    'node_modules/node-pty/build/Release/winpty-agent.exe',
    ...arches.flatMap((targetArch) => [
      `node_modules/node-pty/prebuilds/win32-${targetArch}/pty.node`,
      `node_modules/node-pty/prebuilds/win32-${targetArch}/conpty.node`,
      `node_modules/node-pty/prebuilds/win32-${targetArch}/conpty_console_list.node`,
      `node_modules/node-pty/prebuilds/win32-${targetArch}/winpty.dll`,
      `node_modules/node-pty/prebuilds/win32-${targetArch}/winpty-agent.exe`,
      `node_modules/node-pty/prebuilds/win32-${targetArch}/conpty/conpty.dll`,
      `node_modules/node-pty/prebuilds/win32-${targetArch}/conpty/OpenConsole.exe`,
    ]),
  ]
}

function requiredNativeRuntimeFiles() {
  return []
}

function ptyValidationScript() {
  return `
      const shell = process.env.ComSpec || 'cmd.exe'
      const pty = nodePty.spawn(shell, ['/d', '/s', '/c', 'exit 0'], {
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env,
      })
    `
}

module.exports = {
  nativeRuntimeFiles,
  // Bun/Node spawnSync can throw EINVAL for .cmd with shell:false on Windows.
  npmExecutable: () => 'npm.cmd',
  patchNodePty: false,
  ptyValidationScript,
  requiredNativeRuntimeFiles,
  useShellForNpmInstall: true,
}
