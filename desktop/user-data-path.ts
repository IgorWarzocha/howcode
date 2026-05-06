import os from 'node:os'
import path from 'node:path'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

let cachedUserDataPath: string | null = null

function getDefaultElectronUserDataPath() {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'howcode')
    case 'win32':
      return path.join(
        getProcessEnvironmentVariable('APPDATA') || path.join(os.homedir(), 'AppData', 'Roaming'),
        'howcode',
      )
    default:
      return path.join(
        getProcessEnvironmentVariable('XDG_CONFIG_HOME') || path.join(os.homedir(), '.config'),
        'howcode',
      )
  }
}

export function getDesktopUserDataPath() {
  if (cachedUserDataPath) {
    return cachedUserDataPath
  }

  const configuredUserDataPath = getProcessEnvironmentVariable('HOWCODE_USER_DATA_PATH')?.trim()
  if (configuredUserDataPath) {
    cachedUserDataPath = configuredUserDataPath
    return configuredUserDataPath
  }

  cachedUserDataPath = getDefaultElectronUserDataPath()
  return cachedUserDataPath
}
