import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import { closeDesktopTerminal, listDesktopTerminals } from '../hooks/useDesktopTerminal'

export async function closePiTuiSession(input: { projectId: string; sessionPath: string | null }) {
  const persistedSessionPath = getPersistedSessionPath(input.sessionPath)
  const terminals = await listDesktopTerminals()
  const matchingTerminals = terminals.filter(
    (terminal) =>
      terminal.launchMode === 'pi-session' &&
      terminal.projectId === input.projectId &&
      (terminal.sessionPath === input.sessionPath ||
        (persistedSessionPath !== null &&
          getPersistedSessionPath(terminal.sessionPath) === persistedSessionPath)),
  )

  await Promise.all(
    matchingTerminals.map((terminal) =>
      closeDesktopTerminal({
        sessionId: terminal.sessionId,
        deleteHistory: false,
        force: true,
      }),
    ),
  )
}
