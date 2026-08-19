const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { spawn } = require('node:child_process')
const fsp = require('node:fs/promises')
const { spawnLinuxDetachedLauncher } = require('./integration')
const { isLaunchableFile } = require('./cache')

const LAUNCH_READY_TIMEOUT_MS = 60_000
const LAUNCH_READY_POLL_MS = 100

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

async function waitForLaunchReady(child, readyFile, timeoutMs) {
  await new Promise((resolve, reject) => {
    let settled = false
    const settle = (callback) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(poll)
      callback()
    }
    child.once('error', (error) => settle(() => reject(error)))
    child.once('exit', (code, signal) => {
      if (signal || (code !== null && code !== 0)) {
        settle(() => reject(new Error(`howcode launcher exited with ${code ?? signal}`)))
      }
    })
    const poll = setInterval(() => {
      void fsp.access(readyFile).then(
        () => settle(resolve),
        () => undefined,
      )
    }, LAUNCH_READY_POLL_MS)
    const timeout = setTimeout(
      () =>
        settle(() =>
          reject(
            new Error(
              `howcode did not report ready within ${Math.round(timeoutMs / 1000)} seconds. Executable: ${child.spawnfile}`,
            ),
          ),
        ),
      timeoutMs,
    )
  })
}

async function launch(executablePath, args, options = {}) {
  if (!isLaunchableFile(executablePath)) {
    throw new Error(`Installed howcode executable is not launchable: ${executablePath}`)
  }
  const foreground = isHeadlessLaunchArgs(args)
  const readyFile = foreground
    ? null
    : path.join(options.cacheRoot, `.launch-ready-${process.pid}-${randomUUID()}`)
  if (readyFile) await fsp.rm(readyFile, { force: true })
  const child = spawnLauncherProcess(executablePath, {
    args: getAppLaunchArgs(args),
    foreground,
    env: readyFile ? { HOWCODE_LAUNCH_READY_FILE: readyFile } : {},
  })
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
  try {
    await waitForLaunchReady(child, readyFile, options.readyTimeoutMs || LAUNCH_READY_TIMEOUT_MS)
  } finally {
    child.unref()
    await fsp.rm(readyFile, { force: true }).catch(() => undefined)
  }
}

module.exports = { launch }
