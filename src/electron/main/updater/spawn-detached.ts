import { spawn } from 'node:child_process'
import path from 'node:path'

const SPAWN_HEALTH_GRACE_MS = 1_500

export function spawnDetached(executablePath: string) {
  const env = { ...process.env }
  Reflect.deleteProperty(env, 'NODE_TLS_REJECT_UNAUTHORIZED')

  return new Promise<void>((resolve, reject) => {
    const child = spawn(executablePath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: path.dirname(executablePath),
      env,
    })

    let settled = false
    let graceTimer: NodeJS.Timeout | null = null
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      if (graceTimer) clearTimeout(graceTimer)
      callback()
    }

    child.once('error', (error) => settle(() => reject(error)))
    child.once('exit', (code, signal) => {
      settle(() => reject(new Error(`Updated app exited during startup (${code ?? signal}).`)))
    })
    child.once('spawn', () => {
      graceTimer = setTimeout(() => {
        settle(() => {
          child.unref()
          resolve()
        })
      }, SPAWN_HEALTH_GRACE_MS)
    })
  })
}
