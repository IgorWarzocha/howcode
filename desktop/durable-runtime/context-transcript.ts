import type {
  ImageContent,
  Message,
  TextContent,
  ThinkingContent,
  ToolCall,
} from '@earendil-works/pi-ai'
import { CompactionEntry, type ContextView, SystemEntry } from '@earendil-works/pi-durable'
import { HarnessContextEntry } from '../../shared/harness-context.ts'

function blockText(block: TextContent | ThinkingContent | ImageContent | ToolCall): string {
  switch (block.type) {
    case 'text':
      return block.text
    case 'thinking':
      return block.redacted ? '[Redacted thinking]' : block.thinking
    case 'image':
      return `[Image ${block.mimeType}; base64: ${block.data}]`
    case 'toolCall':
      return `${block.name}(${JSON.stringify(block.arguments)})`
    default:
      throw new Error('Unsupported conversation content.')
  }
}

function messageText(message: Message) {
  const text =
    typeof message.content === 'string'
      ? message.content
      : message.content.map(blockText).filter(Boolean).join('\n')
  const role = message.role === 'toolResult' ? `Tool result: ${message.toolName}` : message.role
  return text ? `[${role}]\n${text}` : ''
}

/** Full task content, not provider replay state: no prompt/tool snapshots, signatures or usage ledger. */
export function contextTranscript(view: ContextView) {
  return view.entries
    .flatMap((entry, index) => {
      if (SystemEntry.is(entry)) return []
      if (HarnessContextEntry.is(entry))
        return [`[Harness context: ${entry.data.label}]\n${entry.data.text}`]
      const text = (view.contributions[index] ?? []).map(messageText).filter(Boolean).join('\n\n')
      return text ? [CompactionEntry.is(entry) ? `[Compaction summary]\n${text}` : text] : []
    })
    .join('\n\n')
}
