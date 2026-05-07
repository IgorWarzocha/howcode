const trailingLineBreakPattern = /\n$/

import { Check, Clipboard } from 'lucide-react'
import {
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  isValidElement,
  type ReactNode,
  useEffect,
  useState,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { inlineCodeClass } from '../../ui/classes'
import { cn } from '../../utils/cn'

type MarkdownTone = 'default' | 'thinking' | 'user'

type MarkdownContentProps = {
  markdown: string
  tone?: MarkdownTone
  className?: string
}

function getToneTextClass(tone: MarkdownTone) {
  switch (tone) {
    case 'thinking':
      return 'text-[color:var(--muted-2)]/78 italic'
    case 'user':
      return 'text-[color:var(--text)]/94'
    default:
      return 'text-[color:var(--text)]/92'
  }
}

function getToneStrongClass(tone: MarkdownTone) {
  switch (tone) {
    case 'thinking':
      return 'text-[color:var(--muted)]/88'
    case 'user':
      return 'text-[color:var(--text)]/96'
    default:
      return 'text-[color:var(--text)]'
  }
}

function MarkdownLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { href, children, ...rest } = props

  return (
    <a
      {...rest}
      href={href}
      className="text-[color:var(--markdown-link)] underline decoration-[color:var(--accent-border)] underline-offset-[3px] transition-colors hover:text-[color:var(--accent)]"
      onClick={(event) => {
        if (!href) {
          return
        }

        if (href.startsWith('http://') || href.startsWith('https://')) {
          event.preventDefault()
          void window.piDesktop?.openExternal?.(href)
        }
      }}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noreferrer' : undefined}
    >
      {children}
    </a>
  )
}

function MarkdownPre({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const text = getNodeText(children).replace(trailingLineBreakPattern, '')

  useEffect(() => {
    if (copyState === 'idle') {
      return
    }

    const timeout = window.setTimeout(() => setCopyState('idle'), 1400)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  if (!text.trim()) {
    return null
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <div className="group relative min-w-0">
      <pre
        {...props}
        className="m-0 max-w-full whitespace-pre-wrap break-words rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--message-code-bg)] px-3 py-2.5 pr-14 font-mono text-[12.5px] leading-6 text-[color:var(--markdown-code)] [overflow-wrap:anywhere]"
      >
        {children}
      </pre>
      <button
        type="button"
        className="absolute right-1.5 top-1.5 grid h-8 min-w-8 place-items-center rounded-[10px] border border-[color:var(--border)] bg-[color:var(--panel)] px-2 text-[11px] font-medium text-[color:var(--muted)] opacity-75 shadow-[var(--shadow)] backdrop-blur-sm transition-[opacity,scale,background-color,color] duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-border)] active:scale-[0.96] group-hover:opacity-100"
        onClick={() => void handleCopy()}
        aria-label={copyState === 'copied' ? 'Copied code block' : 'Copy code block'}
        title={copyState === 'failed' ? 'Copy failed' : copyState === 'copied' ? 'Copied' : 'Copy'}
      >
        {copyState === 'copied' ? <Check size={14} /> : <Clipboard size={14} />}
      </button>
    </div>
  )
}

function getNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join('')
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children)
  }

  return ''
}

function MarkdownInlineCode({ children }: { children?: ReactNode }) {
  return (
    <code
      className={cn(
        inlineCodeClass,
        'bg-[color:var(--markdown-code-bg)] text-[color:var(--markdown-code)]',
      )}
    >
      {children}
    </code>
  )
}

export function MarkdownContent({ markdown, tone = 'default', className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        'grid min-w-0 gap-1.5 text-[14px] leading-[1.68] [overflow-wrap:anywhere] [&_code]:break-all [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-words [&_pre_code]:text-inherit [&_pre_code]:[overflow-wrap:anywhere]',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className={cn('m-0 whitespace-pre-wrap break-words', getToneTextClass(tone))}>
              {children}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="m-0 text-[14px] font-semibold leading-[1.68] text-[color:var(--markdown-heading)]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="m-0 text-[14px] font-semibold leading-[1.68] text-[color:var(--markdown-heading)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="m-0 text-[14px] font-semibold leading-[1.68] text-[color:var(--markdown-heading)]">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="m-0 text-[14px] font-semibold leading-[1.68] text-[color:var(--markdown-heading)]">
              {children}
            </h4>
          ),
          ul: ({ children }) => (
            <ul className="m-0 grid list-disc gap-0.5 pl-5 marker:text-[color:var(--markdown-code)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="m-0 grid list-decimal gap-0.5 pl-5 marker:text-[color:var(--markdown-code)]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className={cn('min-w-0 break-words', getToneTextClass(tone))}>{children}</li>
          ),
          strong: ({ children }) => (
            <strong className={cn('font-semibold', getToneStrongClass(tone))}>{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: MarkdownLink,
          hr: () => <hr className="my-0.5 border-0 border-t border-[color:var(--border-strong)]" />,
          blockquote: ({ children }) => (
            <blockquote className="m-0 border-l border-[color:var(--border-strong)] pl-3 text-[color:var(--markdown-quote)]">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-[12px] border border-[color:var(--border)]">
              <table className="min-w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[color:var(--message-tool-bg)]">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-[color:var(--border)] px-3 py-2 font-medium text-[color:var(--markdown-heading)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className={cn(
                'border-t border-[color:var(--border)] px-3 py-2 align-top',
                getToneTextClass(tone),
              )}
            >
              {children}
            </td>
          ),
          code: ({ children, className: codeClassName }) => {
            const text = String(children ?? '')
            const isBlock = Boolean(codeClassName) || text.includes('\n')
            if (isBlock) {
              return <code className={codeClassName}>{children}</code>
            }

            return <MarkdownInlineCode>{children}</MarkdownInlineCode>
          },
          pre: MarkdownPre,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
