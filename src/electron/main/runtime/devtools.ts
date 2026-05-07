import { app } from 'electron'

function setProcessEnvironmentVariable(name: string, value: string) {
  process.env[name] = value
}

export const HOWCODE_CDP_PORT = 39217

export function configureDevtoolsRemoteDebugging() {
  if (app.isPackaged) {
    return null
  }

  app.commandLine.appendSwitch('remote-debugging-port', String(HOWCODE_CDP_PORT))
  setProcessEnvironmentVariable('HOWCODE_CDP_PORT', String(HOWCODE_CDP_PORT))
  return HOWCODE_CDP_PORT
}

export function logDevtoolsRemoteDebugging(port: number | null) {
  if (!port) {
    return
  }

  console.log(`Howcode CDP listening on http://127.0.0.1:${port}`)
}
