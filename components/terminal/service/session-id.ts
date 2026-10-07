import { createHash } from 'node:crypto'
import type { TerminalOpenRequest } from '../../../shared/terminal-contracts.ts'

export function makeSessionId(request: TerminalOpenRequest) {
  const sessionKey = JSON.stringify({
    projectId: request.projectId,
    // Preserve existing workspace-shell transcript keys. The value is now a Durable ID.
    sessionPath: request.conversationId ?? null,
    cwd: request.cwd ?? request.projectId,
    launchMode: 'shell',
  })

  return `term_${createHash('sha256').update(sessionKey).digest('hex').slice(0, 24)}`
}
