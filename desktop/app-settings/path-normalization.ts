import { homedir } from 'node:os'
import path from 'node:path'

export function expandHomeDirectory(input: string) {
  if (input === '~') return homedir()
  if (input.startsWith(`~${path.sep}`) || input.startsWith('~/')) {
    return path.join(homedir(), input.slice(2))
  }
  return input
}

export function normalizeOptionalSettingsPath(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? ''
  return normalizedValue.length > 0 ? expandHomeDirectory(normalizedValue) : null
}
