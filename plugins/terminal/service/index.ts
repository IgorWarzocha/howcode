export { createTerminalServicePlugin } from './plugin.ts'
export {
  closeAllTerminals,
  closeTerminal,
  disposeTerminalRuntime,
  getTerminalStatus,
  listTerminals,
  openTerminal,
  resizeTerminal,
  subscribeTerminalEvents,
  writeTerminal,
} from './runtime.ts'
export { closeWorkspaceTerminals, hasActiveWorkspaceTerminal } from './workspace-terminals.ts'
