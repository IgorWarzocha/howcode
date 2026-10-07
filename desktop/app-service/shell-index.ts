import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import { ensureConversationProjection } from './conversation-projection.ts'

export async function refreshShellIndex(
  _cwd: string,
  options: { emitRefreshEvent?: boolean | undefined; force?: boolean | undefined } = {},
) {
  await ensureConversationProjection()
  if (options.emitRefreshEvent ?? true) emitDesktopEvent({ type: 'shell-state-refresh' })
  return true
}
