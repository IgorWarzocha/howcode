import ReactMarkdown from 'react-markdown'
import { openExternalQuery } from '../../../query/desktop-query'
import {
  appToneTextClass,
  appTypeCodeClass,
  appTypeReadableClass,
  appTypeReadableStrongClass,
  appTypeSectionTitleClass,
} from '../../../ui/classes'
import remarkGfm from 'remark-gfm'

export function HistoricalMarkdownPreview({ content }: { content: string }) {
  return (
    <div className={`h-full min-h-0 overflow-auto bg-[color:var(--sidebar)] px-7 py-6 ${appTypeReadableClass} ${appToneTextClass} [text-wrap:pretty] [&_h1]:[text-wrap:balance] [&_h2]:[text-wrap:balance] [&_h3]:[text-wrap:balance] [&_pre]:[text-wrap:initial]`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className={`mb-3 ${appTypeReadableStrongClass} ${appToneTextClass}`}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className={`mt-5 mb-2 ${appTypeReadableStrongClass} ${appToneTextClass}`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`mt-4 mb-2 ${appTypeSectionTitleClass} ${appToneTextClass}`}>
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="my-2 text-[color:var(--text)]/92">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-1 text-[color:var(--text)]/92">{children}</li>,
          a: ({ children, href }) => (
            <a
              className="text-[color:var(--accent)] underline underline-offset-2"
              href={href}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noreferrer' : undefined}
              onClick={(event) => {
                if (!(href?.startsWith('http://') || href?.startsWith('https://'))) return
                event.preventDefault()
                void openExternalQuery(href)
              }}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-[rgba(185,191,243,0.32)] pl-4 text-[color:var(--muted)]">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className={`${appTypeCodeClass} text-[color:var(--accent)]`}>{children}</code>
          ),
          pre: ({ children }) => (
            <pre className={`my-3 overflow-auto rounded-lg border border-[color:var(--border)] p-3 ${appTypeCodeClass} ${appToneTextClass}`}>
              {children}
            </pre>
          ),
          hr: () => <hr className="my-5 border-0 border-t border-[color:var(--border)]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
