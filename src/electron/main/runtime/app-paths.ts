import { existsSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

export function getAppRootPath() {
  if (!app.isPackaged) {
    return getProcessEnvironmentVariable('HOWCODE_REPO_ROOT') || process.cwd()
  }

  return app.getAppPath()
}

export function getDesktopBuildDirectory() {
  const desktopBuildDirectory = path.join(getAppRootPath(), 'build', 'desktop')
  const unpackedDesktopBuildDirectory = getAsarUnpackedPath(desktopBuildDirectory)
  if (unpackedDesktopBuildDirectory && existsSync(unpackedDesktopBuildDirectory)) {
    return unpackedDesktopBuildDirectory
  }

  return desktopBuildDirectory
}

function getAsarUnpackedPath(filePath: string) {
  return filePath.includes('.asar') ? filePath.replace('.asar', '.asar.unpacked') : null
}

export function getElectronBuildDirectory() {
  return path.join(getAppRootPath(), 'build', 'electron')
}

export function getRendererDistDirectory() {
  return path.join(getAppRootPath(), 'dist')
}
