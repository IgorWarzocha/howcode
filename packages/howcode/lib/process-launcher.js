const path = require('node:path')
const { spawn } = require('node:child_process')
const { spawnLinuxDetachedLauncher } = require('./integration')
const { isLaunchableFile } = require('./cache')

function isHeadlessLaunchArgs(args) {
  return args.includes('--headless') || process.env.HOWCODE_HEADLESS === '1'
}

function getAppLaunchArgs(args) {
  const appArgs = args.map((arg) => (arg === '--headless' ? '--howcode-headless' : arg))
  if (isHeadlessLaunchArgs(args) && !appArgs.some((arg) => arg.startsWith('--ozone-platform'))) {
    appArgs.push('--ozone-platform=headless')
  }
  return appArgs
}

function spawnLauncherProcess(executablePath, options = {}) {
  const args = options.args || []
  const env = {
    ...process.env,
    HOWCODE_REPO_ROOT: process.env.HOWCODE_REPO_ROOT || process.cwd(),
    ...(options.env || {}),
  }
  Reflect.deleteProperty(env, 'NODE_TLS_REJECT_UNAUTHORIZED')
  if (options.foreground) {
    return spawn(executablePath, args, {
      detached: false,
      stdio: options.stdio || 'inherit',
      windowsHide: false,
      cwd: path.dirname(executablePath),
      env,
    })
  }
  if (process.platform === 'linux') return spawnLinuxDetachedLauncher(executablePath, args, env)
  return spawn(executablePath, args, {
    detached: true,
    stdio: options.stdio || 'ignore',
    windowsHide: true,
    cwd: path.dirname(executablePath),
    env,
  })
}

async function waitForDetachedSpawn(child) {
  await new Promise((resolve, reject) => {
    let settled = false
    const settle = (callback) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback()
    }
    const timer = setTimeout(() => settle(resolve), 1500)
    child.once('spawn', () => settle(resolve))
    child.once('error', (error) => settle(() => reject(error)))
  })
}

async function launch(executablePath, args) {
  if (!isLaunchableFile(executablePath)) {
    throw new Error(`Installed howcode executable is not launchable: ${executablePath}`)
  }
  const foreground = isHeadlessLaunchArgs(args)
  const child = spawnLauncherProcess(executablePath, { args: getAppLaunchArgs(args), foreground })
  if (foreground) {
    await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) => {
        if (signal) return reject(new Error(`howcode exited with signal ${signal}`))
        resolve(code || 0)
      })
    }).then((code) => {
      process.exitCode = code
    })
    return
  }
  await waitForDetachedSpawn(child)
  child.unref()
}

module.exports = { launch }
