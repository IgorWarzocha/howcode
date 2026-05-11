import type { AgentMessage } from '@earendil-works/pi-agent-core'

export type SessionPathEntry = {
  type: string
  id: string
  timestamp?: string | undefined | number
  message?: AgentMessage
  customType?: string | undefined
  content?: string | undefined | unknown[]
  display?: boolean | undefined
  summary?: string | undefined
  provider?: string | undefined
  modelId?: string | undefined
  thinkingLevel?: string | undefined
  tokensBefore?: number | undefined
  firstKeptEntryId?: string | undefined
}

function isDisplayableEntry(entry: SessionPathEntry) {
  return (
    entry.type === 'message' ||
    entry.type === 'custom_message' ||
    entry.type === 'branch_summary' ||
    entry.type === 'model_change' ||
    entry.type === 'thinking_level_change'
  )
}

function modelChangeConsumesNextEntry(
  entry: SessionPathEntry,
  nextEntry: SessionPathEntry | undefined,
) {
  return entry.type === 'model_change' && nextEntry?.type === 'thinking_level_change'
}

function countDisplayableEntriesInRange(
  entries: SessionPathEntry[],
  startIndex: number,
  endIndex: number,
) {
  let count = 0

  for (let index = startIndex; index < endIndex; index += 1) {
    const entry = entries[index]
    if (entry && isDisplayableEntry(entry)) {
      count += 1
      if (modelChangeConsumesNextEntry(entry, entries[index + 1])) {
        index += 1
      }
    }
  }

  return count
}

function appendModelChangeMessage(
  messages: AgentMessage[],
  entry: SessionPathEntry,
  nextEntry: SessionPathEntry | undefined,
) {
  const provider = entry.provider?.trim()
  const modelId = entry.modelId?.trim()
  if (!(provider && modelId)) {
    return false
  }

  const thinkingLevel =
    nextEntry?.type === 'thinking_level_change' ? nextEntry.thinkingLevel?.trim() : undefined
  const modelLabel = thinkingLevel
    ? `${provider}/${modelId}/${thinkingLevel}`
    : `${provider}/${modelId}`

  messages.push({
    role: 'system',
    content: [{ type: 'text', text: modelLabel }],
    label: 'Model changed',
    timestamp: entry.timestamp ?? Date.now(),
  } as unknown as AgentMessage)

  return Boolean(thinkingLevel)
}

function appendThinkingLevelChangeMessage(messages: AgentMessage[], entry: SessionPathEntry) {
  const thinkingLevel = entry.thinkingLevel?.trim()
  if (!thinkingLevel) {
    return
  }

  messages.push({
    role: 'system',
    content: [{ type: 'text', text: thinkingLevel }],
    label: 'Reasoning changed',
    timestamp: entry.timestamp ?? Date.now(),
  } as unknown as AgentMessage)
}

function appendEntryMessage(
  messages: AgentMessage[],
  entry: SessionPathEntry,
  nextEntry: SessionPathEntry | undefined,
) {
  switch (entry.type) {
    case 'message':
      if (entry.message) {
        messages.push(entry.message)
      }
      return
    case 'custom_message':
      if (entry.display === false) {
        return
      }

      messages.push({
        role: 'custom',
        customType: entry.customType ?? 'custom',
        content: entry.content ?? '',
        timestamp: entry.timestamp ?? Date.now(),
      } as unknown as AgentMessage)
      return
    case 'branch_summary':
      if (!entry.summary?.trim()) {
        return
      }

      messages.push({
        role: 'branchSummary',
        summary: entry.summary,
        timestamp: entry.timestamp ?? Date.now(),
      } as unknown as AgentMessage)
      return
    case 'model_change':
      return appendModelChangeMessage(messages, entry, nextEntry)
    case 'thinking_level_change':
      appendThinkingLevelChangeMessage(messages, entry)
      return false
    case 'compaction':
      if (!entry.summary?.trim()) {
        return
      }

      messages.push({
        role: 'compactionSummary',
        summary: entry.summary,
        tokensBefore: entry.tokensBefore ?? 0,
        timestamp: entry.timestamp ?? Date.now(),
      } as unknown as AgentMessage)
      return false
    default:
      return false
  }
}

export function buildSourceMessagesFromPathEntries(pathEntries: SessionPathEntry[]) {
  const messages: AgentMessage[] = []

  appendSourceMessagesFromEntryRange(messages, pathEntries, 0, pathEntries.length)

  return messages
}

function appendSourceMessagesFromEntryRange(
  messages: AgentMessage[],
  pathEntries: SessionPathEntry[],
  startIndex: number,
  endIndex: number,
) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const entry = pathEntries[index]
    if (entry) {
      const consumedNextEntry = appendEntryMessage(messages, entry, pathEntries[index + 1])
      if (consumedNextEntry) {
        index += 1
      }
    }
  }
}

function getSelectedCompactionIndex(pathEntries: SessionPathEntry[], revealedCompactions: number) {
  if (revealedCompactions < 0) {
    return -1
  }

  let remainingCompactionsToSkip = revealedCompactions

  for (let index = pathEntries.length - 1; index >= 0; index -= 1) {
    if (pathEntries[index]?.type !== 'compaction') {
      continue
    }

    if (remainingCompactionsToSkip === 0) {
      return index
    }

    remainingCompactionsToSkip -= 1
  }

  return -1
}

function findEntryIndexById(pathEntries: SessionPathEntry[], entryId: string) {
  for (let index = 0; index < pathEntries.length; index += 1) {
    if (pathEntries[index]?.id === entryId) {
      return index
    }
  }

  return -1
}

export function buildThreadHistorySlice(
  pathEntries: SessionPathEntry[],
  revealedCompactions: number,
) {
  const selectedCompactionIndex = getSelectedCompactionIndex(pathEntries, revealedCompactions)
  if (selectedCompactionIndex === -1) {
    return {
      sourceMessages: buildSourceMessagesFromPathEntries(pathEntries),
      previousMessageCount: 0,
    }
  }

  const selectedCompaction = pathEntries[selectedCompactionIndex]
  const firstKeptEntryId = selectedCompaction?.firstKeptEntryId
  const firstKeptIndex = firstKeptEntryId ? findEntryIndexById(pathEntries, firstKeptEntryId) : -1

  if (!selectedCompaction || firstKeptIndex === -1 || firstKeptIndex > selectedCompactionIndex) {
    return {
      sourceMessages: buildSourceMessagesFromPathEntries(pathEntries),
      previousMessageCount: 0,
    }
  }

  const sourceMessages: AgentMessage[] = []
  appendSourceMessagesFromEntryRange(
    sourceMessages,
    pathEntries,
    firstKeptIndex,
    pathEntries.length,
  )

  return {
    sourceMessages,
    previousMessageCount: countDisplayableEntriesInRange(pathEntries, 0, firstKeptIndex),
  }
}
