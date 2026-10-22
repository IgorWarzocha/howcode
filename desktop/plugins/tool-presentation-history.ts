import type { Message, ToolResultMessage } from '@howaboua/howcode-sdk/chat-renderer'
import type { ToolPresentationHistory } from '@howaboua/howcode-sdk/tool-renderer'
import { installedToolPresentationHistory } from './runtime.ts'

async function readDetails(
  owner: string,
  history: ToolPresentationHistory,
  conversationId: string,
  messages: readonly ToolResultMessage[],
) {
  try {
    const result = await history.readDetails(conversationId, messages)
    const ids = new Set(messages.map((message) => message.id))
    for (const id of result.keys()) {
      if (!ids.has(id)) throw new Error(`Unexpected tool message identity: ${id}`)
    }
    return messages.map((message) =>
      result.has(message.id) ? { ...message, details: result.get(message.id) } : message,
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return messages.map((message) => ({
      ...message,
      presentationError: `${owner}: ${reason}`,
    }))
  }
}

/** Enrich the current display only. Native entries, model context and as-of views are unchanged. */
export async function projectToolPresentationHistory(
  conversationId: string,
  messages: readonly Message[],
): Promise<Message[]> {
  const providers = installedToolPresentationHistory()
  const claims = new Map<string, number>()
  for (const { history } of providers) {
    for (const name of new Set(history.toolNames)) claims.set(name, (claims.get(name) ?? 0) + 1)
  }
  const tools = messages.filter(
    (message): message is ToolResultMessage => message.role === 'toolResult',
  )
  const results = await Promise.all(
    providers.map(({ owner, history }) => {
      const names = new Set(history.toolNames)
      const selected = tools.filter(
        (message) => names.has(message.toolName) && claims.get(message.toolName) === 1,
      )
      return selected.length > 0 ? readDetails(owner, history, conversationId, selected) : []
    }),
  )
  const enriched = new Map(results.flat().map((message) => [message.id, message]))
  return messages.map((message) => {
    if (message.role === 'toolResult' && (claims.get(message.toolName) ?? 0) > 1)
      return {
        ...message,
        presentationError: `Multiple components project ${message.toolName} history.`,
      }
    return enriched.get(message.id) ?? message
  })
}
