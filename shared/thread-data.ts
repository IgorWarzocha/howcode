import type { AgentMessage } from '@earendil-works/pi-agent-core'
import type { ThreadCustomMessageRecord, ThreadData } from './desktop-contracts'
import { getFirstUserTurnTitle, mapAgentMessagesToUiMessages } from './pi-message-mapper'

type BuildThreadDataInput = {
  sessionPath: string
  sourceMessages: readonly AgentMessage[]
  previousMessageCount: number
  isStreaming: boolean
  isCompacting?: boolean | undefined
}

function getThreadCustomMessages(sourceMessages: readonly AgentMessage[]) {
  return sourceMessages.flatMap((message): ThreadCustomMessageRecord[] => {
    const candidate = message as {
      id?: string | undefined
      role?: string | undefined
      customType?: string | undefined
      content?: unknown
      display?: boolean | undefined
      details?: unknown
      timestamp?: string | number | undefined
    }
    if (candidate.role !== 'custom') return []
    return [
      {
        id:
          candidate.id ?? `${candidate.timestamp ?? 'custom'}-${candidate.customType ?? 'custom'}`,
        customType: candidate.customType ?? 'custom',
        content: candidate.content,
        display: candidate.display,
        details: candidate.details,
      },
    ]
  })
}

export function buildThreadData({
  sessionPath,
  sourceMessages,
  previousMessageCount,
  isStreaming,
  isCompacting = false,
}: BuildThreadDataInput): ThreadData {
  const messages = mapAgentMessagesToUiMessages([...sourceMessages])

  return {
    sessionPath,
    title: getFirstUserTurnTitle(messages),
    messages,
    customMessages: getThreadCustomMessages(sourceMessages),
    previousMessageCount,
    isStreaming,
    isCompacting,
  }
}

export function setThreadStreamingState(thread: ThreadData, isStreaming: boolean): ThreadData {
  return thread.isStreaming === isStreaming ? thread : { ...thread, isStreaming }
}

export function setThreadCompactingState(thread: ThreadData, isCompacting: boolean): ThreadData {
  return thread.isCompacting === isCompacting ? thread : { ...thread, isCompacting }
}
