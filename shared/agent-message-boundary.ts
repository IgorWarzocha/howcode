import type { AgentMessage } from '@earendil-works/pi-agent-core'

type AgentMessageShape = {
  role: string
  timestamp?: string | number | undefined
  [key: string]: unknown
}

export function toTrustedAgentMessage(message: AgentMessageShape): AgentMessage {
  return message as unknown as AgentMessage
}

export function withTrustedAgentMessageId(message: AgentMessage, id: string): AgentMessage {
  return toTrustedAgentMessage({ ...(message as object), id, role: message.role })
}
