import { nodePtyAdapter } from './node-pty.ts'

export {
  findExecutable,
  resolveTerminalCommand,
  resolveTerminalEnv,
} from './terminal-command.helpers.ts'

import type { PtyAdapter } from './types.ts'

export function getTerminalAdapter(_options?: { platform?: NodeJS.Platform }): PtyAdapter {
  return nodePtyAdapter
}
