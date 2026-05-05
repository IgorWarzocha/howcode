import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { app } from 'electron'
import { parseDevServerMetadata, resolveDevServerMetadataPath } from '../../../../shared/dev-server'
import { getRendererDistDirectory } from '../runtime/app-paths'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

const DEV_SERVER_PROBE_TIMEOUT_MS = 1_500
const DEV_SERVER_STARTUP_TIMEOUT_MS = 10_000
const DEV_SERVER_STALE_URL_TIMEOUT_MS = 1_500
const DEV_SERVER_RETRY_INTERVAL_MS = 250

function waitForDevServerRetry() {
  return new Promise((resolve) => setTimeout(resolve, DEV_SERVER_RETRY_INTERVAL_MS))
}

async function probeDevServerUrl(devServerUrl: string) {
  await fetch(devServerUrl, {
    method: 'HEAD',
    signal: AbortSignal.timeout(DEV_SERVER_PROBE_TIMEOUT_MS),
  })
}

async function readDevServerUrl(metadataPath: string) {
  try {
    return parseDevServerMetadata(await readFile(metadataPath, 'utf8'))
  } catch {
    // The dev script writes metadata only after Vite is listening. Keep probing briefly so
    // Electron doesn't permanently fall back to the packaged renderer during slow startups.
    return null
  }
}

async function resolveDevServerUrl() {
  const metadataPath = resolveDevServerMetadataPath([
    getProcessEnvironmentVariable('HOWCODE_REPO_ROOT') ?? '',
    app.getAppPath(),
    process.cwd(),
  ])

  if (!metadataPath) {
    return null
  }

  const startupDeadline = Date.now() + DEV_SERVER_STARTUP_TIMEOUT_MS
  let lastDevServerUrl: string | null = null
  let firstProbeFailureAt: number | null = null

  while (Date.now() < startupDeadline) {
    const devServerUrl = await readDevServerUrl(metadataPath)

    if (devServerUrl) {
      if (devServerUrl !== lastDevServerUrl) {
        lastDevServerUrl = devServerUrl
        firstProbeFailureAt = null
      }

      try {
        await probeDevServerUrl(devServerUrl)
        return devServerUrl
      } catch {
        firstProbeFailureAt ??= Date.now()
        if (Date.now() - firstProbeFailureAt >= DEV_SERVER_STALE_URL_TIMEOUT_MS) {
          return null
        }
      }
    }

    await waitForDevServerRetry()
  }

  return null
}

export async function loadMainWindow(mainWindow: BrowserWindow) {
  if (!app.isPackaged) {
    const devServerUrl = await resolveDevServerUrl()
    if (devServerUrl) {
      await mainWindow.loadURL(devServerUrl)
      return
    }
  }

  await mainWindow.loadFile(path.join(getRendererDistDirectory(), 'index.html'))
}
