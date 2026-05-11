import type { AgentMessage } from '@earendil-works/pi-agent-core'
import type { AssistantUsageSummary, Message, ToolResultImage } from './desktop-contracts'

type TextPart = {
  type?: string | undefined
  text?: string | undefined
}

type ThinkingPart = {
  type?: string | undefined
  thinking?: string | undefined
  redacted?: boolean | undefined
}

type RuntimeMessage = {
  role?: string | undefined
  content?:
    | string
    | Array<
        | TextPart
        | {
            type?: string | undefined
            mimeType?: string | undefined
            data?: string | undefined
          }
        | {
            type?: string | undefined
            name?: string | undefined
          }
      >
  timestamp?: string | undefined | number
  errorMessage?: string | undefined
  stopReason?: string | undefined
  toolCallId?: string | undefined
  toolName?: string | undefined
  args?: unknown
  running?: boolean | undefined
  isError?: boolean | undefined
  command?: string | undefined
  output?: string | undefined
  exitCode?: number | undefined
  cancelled?: boolean | undefined
  truncated?: boolean | undefined
  customType?: string | undefined
  label?: string | undefined
  summary?: string | undefined
  usage?:
    | {
        input?: number | undefined
        output?: number | undefined
        cacheRead?: number | undefined
        cacheWrite?: number | undefined
        totalTokens?: number | undefined
        cost?: { total?: number | undefined } | undefined
      }
    | undefined
}

function normalizeAssistantStopReason(value: string | undefined) {
  return value === 'length' || value === 'error' || value === 'aborted' ? value : undefined
}

function getNumberValue(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function mapAssistantUsage(runtimeMessage: RuntimeMessage): AssistantUsageSummary | undefined {
  const usage = runtimeMessage.usage
  if (!usage) return undefined

  return {
    input: getNumberValue(usage.input),
    output: getNumberValue(usage.output),
    cacheRead: getNumberValue(usage.cacheRead),
    cacheWrite: getNumberValue(usage.cacheWrite),
    totalTokens: getNumberValue(usage.totalTokens),
    costTotal: getNumberValue(usage.cost?.total),
  }
}

type SessionBranchEntry = {
  type: string
  id: string
  firstKeptEntryId?: string | undefined
}

const paragraphBreakPattern = /\n{2,}/
const markdownHeadingPattern = /^#{1,6}\s+(.+)$/
const boldOnlyPattern = /^\*\*(.+?)\*\*$/
const underscoreBoldOnlyPattern = /^__(.+?)__$/
const maxToolArgsDisplayLength = 4000

function splitParagraphs(text: string) {
  return text
    .split(paragraphBreakPattern)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function trimTextDocuments(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean)
}

function normalizeThinkingHeader(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const markdownHeading = trimmed.match(markdownHeadingPattern)
  if (markdownHeading?.[1]) {
    return markdownHeading[1].trim()
  }

  const boldOnly = trimmed.match(boldOnlyPattern)
  if (boldOnly?.[1]) {
    return boldOnly[1].trim()
  }

  const underscoreBoldOnly = trimmed.match(underscoreBoldOnlyPattern)
  if (underscoreBoldOnly?.[1]) {
    return underscoreBoldOnly[1].trim()
  }

  return null
}

function getTextParts(content: RuntimeMessage['content']) {
  if (!Array.isArray(content)) {
    return [] as string[]
  }

  const textParts: string[] = []
  for (const part of content) {
    if (part?.type === 'text' && typeof (part as TextPart).text === 'string') {
      textParts.push((part as TextPart).text ?? '')
    }
  }

  return textParts
}

function getThinkingParts(content: RuntimeMessage['content']) {
  if (!Array.isArray(content)) {
    return [] as ThinkingPart[]
  }

  const thinkingParts: ThinkingPart[] = []
  for (const part of content) {
    if (part?.type === 'thinking' && typeof (part as ThinkingPart).thinking === 'string') {
      thinkingParts.push(part as ThinkingPart)
    }
  }

  return thinkingParts
}

function getImageCount(content: RuntimeMessage['content']) {
  if (!Array.isArray(content)) {
    return 0
  }

  let imageCount = 0
  for (const part of content) {
    if (part?.type === 'image') {
      imageCount += 1
    }
  }

  return imageCount
}

function getToolResultImages(content: RuntimeMessage['content']): ToolResultImage[] {
  if (!Array.isArray(content)) {
    return []
  }

  const images: ToolResultImage[] = []
  for (const [index, part] of content.entries()) {
    if (part?.type !== 'image') {
      continue
    }

    const imagePart = part as { data?: unknown | undefined; mimeType?: unknown }
    if (typeof imagePart.data !== 'string' || imagePart.data.trim().length === 0) {
      continue
    }

    const mimeType =
      typeof imagePart.mimeType === 'string' && imagePart.mimeType.trim().length > 0
        ? imagePart.mimeType.trim()
        : 'image/png'
    const data = imagePart.data.trim()

    images.push({
      src: data.startsWith('data:') ? data : `data:${mimeType};base64,${data}`,
      mimeType,
      alt: `Tool result image ${index + 1}`,
    })
  }

  return images
}

function extractUserContent(content: RuntimeMessage['content']) {
  if (typeof content === 'string') {
    return content.trim() ? [content.trim()] : []
  }

  if (!Array.isArray(content)) {
    return [] as string[]
  }

  const text = getTextParts(content).join('\n').trim()
  const imageCount = getImageCount(content)
  const imageLabels = Array.from(
    { length: imageCount },
    (_, index) => `Attached image ${index + 1}`,
  )

  return [text, ...imageLabels].filter(Boolean)
}

function extractDisplayContent(content: RuntimeMessage['content']) {
  if (typeof content === 'string') {
    return splitParagraphs(content)
  }

  if (!Array.isArray(content)) {
    return [] as string[]
  }

  const textParts = getTextParts(content).flatMap((part) => splitParagraphs(part))
  const imageCount = getImageCount(content)
  const imageLabels = Array.from(
    { length: imageCount },
    (_, index) => `Attached image ${index + 1}`,
  )

  return [...textParts, ...imageLabels].filter(Boolean)
}

function normalizeSystemLabel(role: string | undefined) {
  const label = role?.trim() || 'message'
  return label === 'system' ? 'System' : label
}

function extractAssistantContent(message: RuntimeMessage) {
  const content = trimTextDocuments(getTextParts(message.content))

  if (content.length > 0) {
    return content
  }

  if (message.errorMessage) {
    return [message.errorMessage]
  }

  return [] as string[]
}

function extractAssistantThinking(message: RuntimeMessage) {
  const thinkingParts = getThinkingParts(message.content)
  const thinkingContent: string[] = []
  const thinkingHeaders: string[] = []

  for (const part of thinkingParts) {
    for (const paragraph of splitParagraphs(part.thinking ?? '')) {
      thinkingContent.push(paragraph)

      const heading = normalizeThinkingHeader(paragraph)
      if (heading) {
        thinkingHeaders.push(heading)
      }
    }
  }

  return {
    thinkingContent,
    thinkingHeaders,
    thinkingRedacted: thinkingParts.some((part) => Boolean(part.redacted)),
  }
}

export function normalizeThreadTitle(value: unknown) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) {
    return 'New thread'
  }

  return text.length > 72 ? `${text.slice(0, 69)}...` : text
}

function mapUserMessage(id: string, runtimeMessage: RuntimeMessage): Message | null {
  const content = extractUserContent(runtimeMessage.content)
  return content.length === 0 ? null : { id, role: 'user', content }
}

function mapAssistantMessage(id: string, runtimeMessage: RuntimeMessage): Message | null {
  const content = extractAssistantContent(runtimeMessage)
  const { thinkingContent, thinkingHeaders, thinkingRedacted } =
    extractAssistantThinking(runtimeMessage)

  if (content.length === 0 && thinkingContent.length === 0) return null

  return {
    id,
    role: 'assistant',
    content,
    isError: runtimeMessage.stopReason === 'error' || undefined,
    stopReason: normalizeAssistantStopReason(runtimeMessage.stopReason),
    usage: mapAssistantUsage(runtimeMessage),
    thinkingContent: thinkingContent.length > 0 ? thinkingContent : undefined,
    thinkingHeaders: thinkingHeaders.length > 0 ? [...new Set(thinkingHeaders)] : undefined,
    thinkingRedacted: thinkingRedacted || undefined,
  }
}

function mapToolResultMessage(id: string, runtimeMessage: RuntimeMessage): Message {
  const text = extractUserContent(runtimeMessage.content)
  const images = getToolResultImages(runtimeMessage.content)
  return {
    id,
    role: 'toolResult',
    toolCallId: runtimeMessage.toolCallId?.trim() || undefined,
    toolName: runtimeMessage.toolName ?? 'tool',
    content: text.length > 0 ? text : [runtimeMessage.isError ? 'Tool failed.' : 'Tool finished.'],
    images: images.length > 0 ? images : undefined,
    isError: Boolean(runtimeMessage.isError),
    args: formatToolArgs(runtimeMessage.args),
    running: runtimeMessage.running || undefined,
  }
}

function formatToolArgs(args: unknown) {
  if (args === undefined || args === null) return undefined
  if (typeof args === 'string') return truncateToolArgs(args.trim())

  try {
    return truncateToolArgs(JSON.stringify(args, null, 2))
  } catch {
    return truncateToolArgs(String(args))
  }
}

function truncateToolArgs(value: string | undefined) {
  if (!value) return undefined
  if (value.length <= maxToolArgsDisplayLength) return value
  return `${value.slice(0, maxToolArgsDisplayLength)}\n… truncated ${value.length - maxToolArgsDisplayLength} chars`
}

function mapCustomMessage(id: string, runtimeMessage: RuntimeMessage): Message | null {
  const content = extractDisplayContent(runtimeMessage.content)
  if (content.length === 0) return null

  const customType = runtimeMessage.customType ?? 'custom'
  return {
    id,
    role: 'custom',
    customType,
    content,
    isError: customType === 'howcode.extension.error' || undefined,
  }
}

function mapSystemMessage(id: string, runtimeMessage: RuntimeMessage): Message | null {
  const content = extractDisplayContent(runtimeMessage.content)
  return content.length === 0
    ? null
    : { id, role: 'system', label: runtimeMessage.label?.trim() || 'System', content }
}

function mapSummaryMessage(id: string, runtimeMessage: RuntimeMessage): Message | null {
  return runtimeMessage.summary?.trim()
    ? {
        id,
        role: runtimeMessage.role as 'branchSummary' | 'compactionSummary',
        content: splitParagraphs(runtimeMessage.summary),
      }
    : null
}

function mapFallbackMessage(id: string, runtimeMessage: RuntimeMessage): Message | null {
  const content = extractDisplayContent(runtimeMessage.content)
  return content.length === 0
    ? null
    : { id, role: 'system', label: normalizeSystemLabel(runtimeMessage.role), content }
}

export function mapAgentMessageToUiMessage(
  agentMessage: AgentMessage,
  messageIndex: number,
): Message | null {
  const runtimeMessage = agentMessage as RuntimeMessage
  const id = `${runtimeMessage.timestamp ?? messageIndex}-${runtimeMessage.role ?? 'message'}`

  switch (runtimeMessage.role) {
    case 'user':
      return mapUserMessage(id, runtimeMessage)
    case 'assistant':
      return mapAssistantMessage(id, runtimeMessage)
    case 'toolResult':
      return mapToolResultMessage(id, runtimeMessage)

    case 'bashExecution': {
      return {
        id,
        role: 'bashExecution',
        command: runtimeMessage.command ?? '',
        output: splitParagraphs(runtimeMessage.output ?? '').slice(0, 12),
        exitCode: runtimeMessage.exitCode ?? null,
        cancelled: Boolean(runtimeMessage.cancelled),
        truncated: Boolean(runtimeMessage.truncated),
      }
    }

    case 'custom':
      return mapCustomMessage(id, runtimeMessage)
    case 'system':
      return mapSystemMessage(id, runtimeMessage)

    case 'branchSummary':
    case 'compactionSummary':
      return mapSummaryMessage(id, runtimeMessage)
    default:
      return mapFallbackMessage(id, runtimeMessage)
  }
}

export function mapAgentMessagesToUiMessages(messages: AgentMessage[]) {
  return messages
    .map((agentMessage, messageIndex) => mapAgentMessageToUiMessage(agentMessage, messageIndex))
    .filter((uiMessage): uiMessage is Message => uiMessage !== null)
}

export function getFirstUserTurnTitle(messages: Message[]) {
  const firstUserMessage = messages.find((uiMessage) => uiMessage.role === 'user') as
    | Extract<Message, { role: 'assistant' | 'user' }>
    | undefined
  return normalizeThreadTitle(firstUserMessage?.content[0])
}

export function getPreviousMessageCount(entries: SessionBranchEntry[]) {
  let compactionIndex = -1
  for (let entryIndex = entries.length - 1; entryIndex >= 0; entryIndex -= 1) {
    if (entries[entryIndex]?.type === 'compaction') {
      compactionIndex = entryIndex
      break
    }
  }

  if (compactionIndex === -1) {
    return 0
  }

  const compactionEntry = entries[compactionIndex]
  const firstKeptEntryId = compactionEntry?.firstKeptEntryId

  if (!firstKeptEntryId) {
    return 0
  }

  let count = 0

  for (let entryIndex = 0; entryIndex < compactionIndex; entryIndex += 1) {
    const entry = entries[entryIndex]
    if (entry?.id === firstKeptEntryId) {
      break
    }

    if (
      entry?.type === 'message' ||
      entry?.type === 'custom_message' ||
      entry?.type === 'branch_summary'
    ) {
      count += 1
    }
  }

  return count
}
