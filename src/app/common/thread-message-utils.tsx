import { Check, Clipboard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { appTypeGroupTextClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { MarkdownContent } from './markdown-content'

const copyButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--surface-hover)] text-[color:var(--muted)] opacity-0 transition-[opacity,background-color,color,transform] delay-300 duration-150 ease-out hover:bg-[color:var(--folded-row-hover-bg)] hover:text-[color:var(--text)] hover:opacity-100 hover:delay-0 focus-visible:opacity-100 focus-visible:delay-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-border)] active:scale-[0.96] group-hover/message:opacity-100 group-hover/message:delay-0 group-focus-within/message:opacity-100 group-focus-within/message:delay-0'

export function CopyMessageButton({ label, text }: { label: string; text: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (copyState === 'idle') return
    const timeout = window.setTimeout(() => setCopyState('idle'), 1400)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  if (text.trim().length === 0) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <button
      type="button"
      className={copyButtonClass}
      onClick={(event) => {
        event.stopPropagation()
        void handleCopy()
      }}
      aria-label={copyState === 'copied' ? `Copied ${label}` : `Copy ${label}`}
      title={copyState === 'failed' ? 'Copy failed' : copyState === 'copied' ? 'Copied' : 'Copy'}
      data-no-row-toggle="true"
    >
      {copyState === 'copied' ? <Check size={13} /> : <Clipboard size={13} />}
    </button>
  )
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
      {content.map((paragraph) => (
        <MarkdownContent key={paragraph} markdown={paragraph} tone={tone} />
      ))}
    </div>
  )
}

export function renderThinking(content: string[], tone: 'system' | 'thinking' = 'thinking') {
  return (
    <div className="grid min-w-0 gap-2 [overflow-wrap:anywhere]">
      {content.map((paragraph) => (
        <div key={paragraph} className="group/message relative min-w-0 pr-9">
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
