import os from 'node:os'
import path from 'node:path'
import { loadAppSettings } from '../app-settings/readers.ts'

export function getAgentDirectory() {
  const custom = loadAppSettings().customPiDirectory?.trim()
  const { PI_CODING_AGENT_DIR } = process.env
  const configured = custom || PI_CODING_AGENT_DIR?.trim()
  return configured ? path.resolve(configured) : path.join(os.homedir(), '.pi', 'agent')
}
