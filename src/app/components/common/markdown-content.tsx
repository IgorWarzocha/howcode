const trailingLineBreakPattern = /\n$/
const languageClassPattern = /(?:^|\s)language-([^\s]+)/

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
import { openExternalQuery } from '../../query/desktop-query'
import {
  appToneMutedClass,
  appTypeCodeBlockClass,
  appTypeGroupTextClass,
  appTypeGroupTitleClass,
  appTypeMetaStrongClass,
  appTypeReadableClass,
  appTypeReadableStrongClass,
  inlineCodeClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type MarkdownTone = 'default' | 'thinking' | 'system' | 'user'

type MarkdownContentProps = {
  markdown: string
  tone?: MarkdownTone
  className?: string
}

function getMarkdownToneClass(tone: MarkdownTone) {
  switch (tone) {
    case 'thinking':
      return 'text-[color:var(--muted-2)]/78 italic'
    case 'system':
      return 'text-[color:var(--muted)]/84'
    case 'user':
      return 'text-[color:var(--text)]/94'
    default:
      return 'text-[color:var(--text)]/92'
  }
}

function getMarkdownStrongToneClass(tone: MarkdownTone) {
  switch (tone) {
    case 'thinking':
      return 'text-[color:var(--muted)]/88'
    case 'system':
      return 'text-[color:var(--muted)]/92'
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
      className="break-words text-[color:var(--markdown-link)] underline decoration-[color:var(--accent-border)] underline-offset-[3px] transition-colors [overflow-wrap:anywhere] hover:text-[color:var(--accent)]"
      onClick={(event) => {
        if (!href) {
          return
        }

        if (href.startsWith('http://') || href.startsWith('https://')) {
          event.preventDefault()
          void openExternalQuery(href)
        }
      }}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noreferrer' : undefined}
    >
      {children}
    </a>
  )
}

function getCodeBlockLanguage(children: ReactNode) {
  if (!isValidElement<{ className?: string }>(children)) return null
  const className = children.props.className ?? ''
  const language = languageClassPattern.exec(className)?.[1]
  return language ? language.replaceAll('-', ' ') : null
}

function MarkdownPre({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const text = getNodeText(children).replace(trailingLineBreakPattern, '')
  const language = getCodeBlockLanguage(children)

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
    <div className="group relative min-w-0 overflow-hidden rounded-lg bg-[color:var(--code-block-bg)]">
      <div className="flex h-8 items-center justify-between bg-[color:var(--code-block-header-bg)] px-3">
        <span
          className={cn(
            'truncate uppercase tracking-[0.08em] text-[color:var(--muted-2)]',
            appTypeMetaStrongClass,
          )}
        >
          {language ?? 'code'}
        </span>
      </div>
      <pre
        {...props}
        className={cn(
          'm-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words bg-transparent px-3 py-3 pr-14 text-[color:var(--code-block-text)] [overflow-wrap:anywhere]',
          appTypeCodeBlockClass,
        )}
      >
        {children}
      </pre>
      <button
        type="button"
        className={cn(
          'absolute top-1 right-1 grid h-6 min-w-6 place-items-center rounded-md bg-transparent px-1.5 opacity-55 transition-[opacity,scale,background-color,color] duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-border)] active:scale-[0.96] group-hover:opacity-100',
          appTypeMetaStrongClass,
          appToneMutedClass,
        )}
        onClick={() => void handleCopy()}
        aria-label={copyState === 'copied' ? 'Copied code block' : 'Copy code block'}
        title={copyState === 'failed' ? 'Copy failed' : copyState === 'copied' ? 'Copied' : 'Copy'}
      >
        {copyState === 'copied' ? <Check size={13} /> : <Clipboard size={13} />}
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
        'bg-[color:var(--inline-code-bg)] text-[color:var(--inline-code-text)]',
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
        'grid min-w-0 max-w-full gap-1.5 break-words [overflow-wrap:anywhere] [&_*]:min-w-0 [&_code]:break-all [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-words [&_pre_code]:text-inherit [&_pre_code]:[overflow-wrap:anywhere]',
        appTypeReadableClass,
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p
              className={cn(
                'm-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
                getMarkdownToneClass(tone),
              )}
            >
              {children}
            </p>
          ),
          h1: ({ children }) => (
            <h1
              className={cn(
                'm-0 max-w-full break-words [overflow-wrap:anywhere]',
                appTypeReadableStrongClass,
                tone === 'system'
                  ? 'text-[color:var(--muted)]/92'
                  : 'text-[color:var(--markdown-heading)]',
              )}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={cn(
                'm-0 max-w-full break-words [overflow-wrap:anywhere]',
                appTypeReadableStrongClass,
                tone === 'system'
                  ? 'text-[color:var(--muted)]/92'
                  : 'text-[color:var(--markdown-heading)]',
              )}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={cn(
                'm-0 max-w-full break-words [overflow-wrap:anywhere]',
                appTypeReadableStrongClass,
                tone === 'system'
                  ? 'text-[color:var(--muted)]/92'
                  : 'text-[color:var(--markdown-heading)]',
              )}
            >
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4
              className={cn(
                'm-0 max-w-full break-words [overflow-wrap:anywhere]',
                appTypeReadableStrongClass,
                tone === 'system'
                  ? 'text-[color:var(--muted)]/92'
                  : 'text-[color:var(--markdown-heading)]',
              )}
            >
              {children}
            </h4>
          ),
          ul: ({ children }) => (
            <ul
              className={cn(
                'm-0 grid list-disc gap-0.5 pl-5',
                tone === 'system'
                  ? 'marker:text-[color:var(--muted)]/72'
                  : 'marker:text-[color:var(--markdown-code)]',
              )}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={cn(
                'm-0 grid list-decimal gap-0.5 pl-5',
                tone === 'system'
                  ? 'marker:text-[color:var(--muted)]/72'
                  : 'marker:text-[color:var(--markdown-code)]',
              )}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li
              className={cn(
                'min-w-0 break-words [overflow-wrap:anywhere]',
                getMarkdownToneClass(tone),
              )}
            >
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className={cn(appTypeReadableStrongClass, getMarkdownStrongToneClass(tone))}>
              {children}
            </strong>
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
              <table className={cn('min-w-full border-collapse text-left', appTypeGroupTextClass)}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[color:var(--message-tool-bg)]">{children}</thead>
          ),
          th: ({ children }) => (
            <th
              className={cn(
                'border-b border-[color:var(--border)] px-3 py-2',
                appTypeGroupTitleClass,
                tone === 'system'
                  ? 'text-[color:var(--muted)]/92'
                  : 'text-[color:var(--markdown-heading)]',
              )}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className={cn(
                'border-t border-[color:var(--border)] px-3 py-2 align-top',
                getMarkdownToneClass(tone),
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
