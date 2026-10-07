import type { ThreadData } from './desktop-contracts'

export function setThreadStreamingState(thread: ThreadData, isStreaming: boolean): ThreadData {
  return thread.isStreaming === isStreaming ? thread : { ...thread, isStreaming }
}

export function setThreadCompactingState(thread: ThreadData, isCompacting: boolean): ThreadData {
  return thread.isCompacting === isCompacting ? thread : { ...thread, isCompacting }
}
