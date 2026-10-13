import { getInstalledRendererContributions } from './component-system/installed-component-catalog'
import type {
  TerminalCloseRequest,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
} from './desktop/types'

function terminalBridge() {
  return getInstalledRendererContributions()['@howaboua/howcode-terminal']
    ? window.piDesktop
    : undefined
}

export const terminalClient = {
  listDesktopTerminals: async () => (await terminalBridge()?.listTerminals?.()) ?? [],
  openDesktopTerminal: async (request: TerminalOpenRequest) =>
    (await terminalBridge()?.openTerminal?.(request)) ?? null,
  writeDesktopTerminal: async (sessionId: string, data: string) => {
    await terminalBridge()?.writeTerminal?.(sessionId, data)
  },
  resizeDesktopTerminal: async (request: TerminalResizeRequest) => {
    await terminalBridge()?.resizeTerminal?.(request)
  },
  closeDesktopTerminal: async (request: TerminalCloseRequest) => {
    await terminalBridge()?.closeTerminal?.(request)
  },
  subscribeDesktopTerminal: (listener: (event: TerminalEvent) => void) =>
    terminalBridge()?.subscribeTerminal?.(listener) ?? (() => undefined),
}
export const { listDesktopTerminals, subscribeDesktopTerminal } = terminalClient
