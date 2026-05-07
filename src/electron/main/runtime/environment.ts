import { createRequire } from 'node:module'
import path from 'node:path'
import { app } from 'electron'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function setProcessEnvironmentVariable(name: string, value: string) {
  process.env[name] = value
}

const require = createRequire(__filename)

function resolvePiPackageDirectory() {
  try {
    return path.dirname(require.resolve('@earendil-works/pi-coding-agent/package.json'))
  } catch {
    return null
  }
}

function resolveConfiguredUserDataPath() {
  const configuredUserDataPath = getProcessEnvironmentVariable('HOWCODE_USER_DATA_PATH')?.trim()
  if (configuredUserDataPath) {
    return configuredUserDataPath
  }

  const defaultUserDataPath = app.getPath('userData')
  return app.isPackaged ? defaultUserDataPath : path.join(defaultUserDataPath, 'dev')
}

export function configureDesktopEnvironment() {
  const userDataPath = resolveConfiguredUserDataPath()
  app.setPath('userData', userDataPath)
  setProcessEnvironmentVariable('HOWCODE_USER_DATA_PATH', userDataPath)

  const piPackageDirectory = resolvePiPackageDirectory()
  if (piPackageDirectory) {
    setProcessEnvironmentVariable('PI_PACKAGE_DIR', piPackageDirectory)
  }
}
