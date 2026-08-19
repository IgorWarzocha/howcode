import type { Message, ThreadData } from './desktop-thread-contracts'
import type { ThreadSearchMatchSchema, ThreadSearchResultSchema } from './thread-search-schema'

export type ThreadSearchMatch = typeof ThreadSearchMatchSchema.Type

export type ThreadSearchResult = typeof ThreadSearchResultSchema.Type

const snippetRadius = 72

function getSearchableMessageText(message: Message) {
  switch (message.role) {
    case 'user':
    case 'assistant':
      return message.content.join('\n\n')
    case 'custom':
    case 'system':
    case 'branchSummary':
    case 'compactionSummary':
      return message.content.join('\n\n')
    case 'toolResult':
    case 'bashExecution':
      return ''
    default:
      return ''
  }
}

function normalizeSnippetText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function createSnippet(text: string, matchIndex: number, queryLength: number) {
  const start = Math.max(0, matchIndex - snippetRadius)
  const end = Math.min(text.length, matchIndex + queryLength + snippetRadius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  const rawSnippet = `${prefix}${text.slice(start, end)}${suffix}`
  const snippet = normalizeSnippetText(rawSnippet)
  const leadingEllipsisOffset = prefix.length
  const rawMatchStart = leadingEllipsisOffset + matchIndex - start
  const beforeMatch = normalizeSnippetText(rawSnippet.slice(0, rawMatchStart))
  const matchStart = beforeMatch.length + (beforeMatch ? 1 : 0)
  return {
    snippet,
    matchStart: Math.max(0, Math.min(snippet.length, matchStart)),
    matchEnd: Math.max(0, Math.min(snippet.length, matchStart + queryLength)),
  }
}

export function searchThreadData(thread: ThreadData, query: string): ThreadSearchResult {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return { matches: [], searchedMessageCount: thread.messages.length }

  const matches: ThreadSearchMatch[] = []
  for (const [messageIndex, message] of thread.messages.entries()) {
    const text = getSearchableMessageText(message)
    if (!text) continue
    const matchIndex = text.toLowerCase().indexOf(normalizedQuery)
    if (matchIndex === -1) continue
    const snippet = createSnippet(text, matchIndex, normalizedQuery.length)
    matches.push({
      messageId: message.id,
      messageIndex,
      role: message.role,
      ...snippet,
    })
  }

  return { matches, searchedMessageCount: thread.messages.length }
}
