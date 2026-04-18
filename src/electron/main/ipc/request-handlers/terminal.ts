import type { DesktopRequestHandlerMap } from "../../../../../shared/desktop-ipc";
import type { TerminalManagerModule } from "../../runtime/desktop-runtime-contracts";

type TerminalRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  "listTerminals" | "terminalOpen" | "terminalWrite" | "terminalResize" | "terminalClose"
>;

export function createTerminalHandlers(
  terminalManager: TerminalManagerModule,
): TerminalRequestHandlers {
  return {
    listTerminals: () => terminalManager.listTerminals(),
    terminalOpen: (request) => terminalManager.openTerminal(request),
    terminalWrite: async ({ sessionId, data }) => {
      await terminalManager.writeTerminal(sessionId, data);
      return { ok: true };
    },
    terminalResize: async ({ sessionId, cols, rows }) => {
      await terminalManager.resizeTerminal(sessionId, cols, rows);
      return { ok: true };
    },
    terminalClose: async (request) => {
      await terminalManager.closeTerminal(request);
      return { ok: true };
    },
  };
}
