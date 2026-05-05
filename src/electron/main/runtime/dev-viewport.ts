const devViewportPattern = /^(\d{3,5})x(\d{3,5})$/

import { app, type BrowserWindow } from 'electron'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

const viewportPresets = {
  '768p': { width: 1366, height: 768 },
} as const

function parseDevViewport(value: string | undefined) {
  const normalizedValue = value?.trim().toLowerCase()
  if (!normalizedValue) {
    return null
  }

  if (normalizedValue in viewportPresets) {
    return viewportPresets[normalizedValue as keyof typeof viewportPresets]
  }

  const match = devViewportPattern.exec(normalizedValue)
  if (!match) {
    console.warn(`Ignoring invalid HOWCODE_DEV_VIEWPORT value: ${value}`)
    return null
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  }
}

export async function applyDevViewport(mainWindow: BrowserWindow) {
  if (app.isPackaged) {
    return
  }

  const viewport = parseDevViewport(getProcessEnvironmentVariable('HOWCODE_DEV_VIEWPORT'))
  if (!viewport) {
    return
  }

  mainWindow.setContentSize(viewport.width, viewport.height)

  try {
    mainWindow.webContents.debugger.attach('1.3')
    await mainWindow.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    })
    console.log(`Howcode dev viewport emulation: ${viewport.width}x${viewport.height}`)
  } catch (error) {
    console.warn('Failed to apply Howcode dev viewport emulation.', error)
  }
}
