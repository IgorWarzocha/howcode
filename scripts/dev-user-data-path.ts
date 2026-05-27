import os from 'node:os'
import path from 'node:path'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

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

export function getDevUserDataPath() {
  if (getProcessEnvironmentVariable('HOWCODE_DEV_USER_DATA_PROFILE')?.trim() === 'app') {
    return getDefaultElectronUserDataPath()
  }

  return (
    getProcessEnvironmentVariable('HOWCODE_DEV_USER_DATA_PATH')?.trim() ||
    path.join(getDefaultElectronUserDataPath(), 'dev')
  )
}
