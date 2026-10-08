import { appTypeGroupTextClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { CopyMessageButton } from './copy-message-button'
import { MarkdownContent } from './markdown-content'

export function getParagraphRenderItems(content: string[]) {
  const seen = new Map<string, number>()
  return content.map((paragraph) => {
    const occurrence = seen.get(paragraph) ?? 0
    seen.set(paragraph, occurrence + 1)
    return { key: `${paragraph}:${occurrence}`, paragraph }
  })
}

export function renderProse(
  content: string[],
  format: 'prose' | 'list' = 'prose',
  tone: 'default' | 'system' = 'default',
) {
  if (format === 'list') {
    return (
      <MarkdownContent
        markdown={content.map((item) => `- ${item}`).join('\n')}
        tone={tone}
        className="gap-1.5 text-pretty"
      />
    )
  }

  return (
    <div className="grid min-w-0 gap-3 text-pretty [overflow-wrap:anywhere]">
      {getParagraphRenderItems(content).map(({ key, paragraph }) => (
        <MarkdownContent key={key} markdown={paragraph} tone={tone} />
      ))}
    </div>
  )
}

export function renderThinking(content: string[], tone: 'system' | 'thinking' = 'thinking') {
  return (
    <div className="grid min-w-0 gap-2 [overflow-wrap:anywhere]">
      {getParagraphRenderItems(content).map(({ key, paragraph }) => (
        <div key={key} className="group/message relative min-w-0 pr-9">
          <MarkdownContent
            markdown={paragraph}
            tone={tone}
            className={cn('gap-1', appTypeGroupTextClass)}
          />
          <div className="absolute top-0 right-0">
            <CopyMessageButton label="thinking paragraph" text={paragraph} />
          </div>
        </div>
      ))}
    </div>
  )
}
