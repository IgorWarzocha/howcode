import { writeFile } from 'node:fs/promises'

const LAUNCH_READY_FILE_ENV = 'HOWCODE_LAUNCH_READY_FILE'

export async function signalLauncherReady() {
  const readyFile = process.env[LAUNCH_READY_FILE_ENV]
  if (!readyFile) return
  Reflect.deleteProperty(process.env, LAUNCH_READY_FILE_ENV)
  await writeFile(readyFile, 'ready', { flag: 'wx' })
}
