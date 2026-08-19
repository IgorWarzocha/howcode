const fsp = require('node:fs/promises')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { APP_NAME } = require('./config')

function shellSingleQuote(value) {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function getLinuxSetsidPath() {
  for (const candidate of ['/usr/bin/setsid', '/bin/setsid']) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function spawnLinuxDetachedLauncher(executablePath, args, env) {
  const setsidPath = getLinuxSetsidPath()
  if (setsidPath) {
    return spawn(setsidPath, ['-f', executablePath, ...args], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: path.dirname(executablePath),
      env,
    })
  }
  return spawn(
    '/bin/sh',
    [
      '-c',
      `nohup ${[executablePath, ...args].map(shellSingleQuote).join(' ')} >/dev/null 2>&1 </dev/null &`,
    ],
    { detached: true, stdio: 'ignore', windowsHide: true, cwd: path.dirname(executablePath), env },
  )
}

function getLinuxCommandLauncherPath() {
  return path.join(process.env.XDG_BIN_HOME || path.join(os.homedir(), '.local', 'bin'), APP_NAME)
}

async function writeLinuxCommandLauncher(paths) {
  const launcherPath = getLinuxCommandLauncherPath()
  const launcherContents = [
    '#!/bin/sh',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a shell parameter expansion.
    'export HOWCODE_REPO_ROOT=${HOWCODE_REPO_ROOT:-$(pwd)}',
    'if [ "$1" = "--headless" ] || [ "$HOWCODE_HEADLESS" = "1" ]; then',
    '  if [ "$1" = "--headless" ]; then',
    '    shift',
    `    exec ${shellSingleQuote(paths.executablePath)} --howcode-headless --ozone-platform=headless "$@"`,
    '  fi',
    `  exec ${shellSingleQuote(paths.executablePath)} --ozone-platform=headless "$@"`,
    'fi',
    'if command -v setsid >/dev/null 2>&1; then',
    `  setsid -f ${shellSingleQuote(paths.executablePath)} "$@" >/dev/null 2>&1 </dev/null`,
    'else',
    `  nohup ${shellSingleQuote(paths.executablePath)} "$@" >/dev/null 2>&1 </dev/null &`,
    'fi',
    'exit 0',
    '',
  ].join('\n')
  await fsp.mkdir(path.dirname(launcherPath), { recursive: true })
  await fsp.writeFile(launcherPath, launcherContents, { encoding: 'utf8', mode: 0o755 })
  await fsp.chmod(launcherPath, 0o755)
  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  if (!pathEntries.includes(path.dirname(launcherPath))) {
    console.warn(
      `howcode: created ${launcherPath}, but ${path.dirname(launcherPath)} is not in PATH.`,
    )
  }
}

function getWindowsStartMenuShortcutPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${APP_NAME}.lnk`)
}

function getWindowsScriptHostPath(executableName) {
  const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT
  return path.join(systemRoot || 'C:\\Windows', 'System32', executableName)
}

async function writeWindowsCommandLauncher(paths) {
  const commandContents = [
    '@echo off',
    'chcp 65001 >nul',
    'setlocal',
    'set NODE_TLS_REJECT_UNAUTHORIZED=',
    `set "HOWCODE_EXE=${paths.executablePath.replace(/%/g, '%%')}"`,
    `set "HOWCODE_REPO_ROOT=${paths.launcherWorkingDirectory.replace(/%/g, '%%')}"`,
    'if not exist "%HOWCODE_EXE%" (',
    '  echo howcode: installed app executable was not found.',
    '  echo Run npx howcode to repair the local install.',
    '  exit /b 1',
    ')',
    'if "%~1"=="--headless" (',
    '  shift /1',
    '  "%HOWCODE_EXE%" --howcode-headless --ozone-platform=headless %*',
    '  exit /b %ERRORLEVEL%',
    ')',
    'if "%HOWCODE_HEADLESS%"=="1" (',
    '  "%HOWCODE_EXE%" --ozone-platform=headless %*',
    '  exit /b %ERRORLEVEL%',
    ')',
    'start "" /D "%HOWCODE_REPO_ROOT%" "%HOWCODE_EXE%" %*',
    'endlocal',
    '',
  ].join('\r\n')
  await fsp.writeFile(paths.windowsCommandFile, commandContents, 'utf8')
}

async function createWindowsStartMenuShortcut(paths) {
  const shortcutPath = getWindowsStartMenuShortcutPath()
  const shortcutScriptPath = path.join(
    paths.cacheRoot,
    `.create-${APP_NAME}-shortcut-${process.pid}.js`,
  )
  await fsp.mkdir(path.dirname(shortcutPath), { recursive: true })
  await fsp.writeFile(
    shortcutScriptPath,
    [
      "var shell = WScript.CreateObject('WScript.Shell');",
      'var shortcut = shell.CreateShortcut(WScript.Arguments.Item(0));',
      'shortcut.TargetPath = WScript.Arguments.Item(1);',
      'shortcut.WorkingDirectory = WScript.Arguments.Item(2);',
      'shortcut.IconLocation = WScript.Arguments.Item(3);',
      'shortcut.Description = WScript.Arguments.Item(4);',
      'shortcut.Save();',
      '',
    ].join('\r\n'),
    'utf8',
  )
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        getWindowsScriptHostPath('cscript.exe'),
        [
          '//NoLogo',
          shortcutScriptPath,
          shortcutPath,
          paths.windowsCommandFile,
          paths.launcherWorkingDirectory,
          `${paths.executablePath},0`,
          'howcode',
        ],
        { stdio: 'ignore', windowsHide: true },
      )
      child.on('error', reject)
      child.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`cscript exited with code ${code}.`)),
      )
    })
  } finally {
    await fsp.rm(shortcutScriptPath, { force: true })
  }
  return shortcutPath
}

async function ensureCommandLaunchIntegration(target, paths) {
  if (target.os === 'linux') {
    try {
      await writeLinuxCommandLauncher(paths)
      return true
    } catch (error) {
      console.warn(`howcode: could not create command launcher: ${error.message || error}`)
      return false
    }
  }
  if (target.os !== 'win') return true
  try {
    await writeWindowsCommandLauncher(paths)
    await createWindowsStartMenuShortcut(paths)
    return true
  } catch (error) {
    console.warn(`howcode: could not update Windows launch integration: ${error.message || error}`)
    return false
  }
}

module.exports = { ensureCommandLaunchIntegration, spawnLinuxDetachedLauncher }
