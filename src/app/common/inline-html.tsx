import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import type { PluggableList } from 'unified'

const displayHtmlPlugins: PluggableList = [
  rehypeRaw,
  [
    rehypeSanitize,
    {
      tagNames: [
        'p',
        'br',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'del',
        'blockquote',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'code',
        'pre',
        'hr',
        'a',
        'details',
        'summary',
        'kbd',
        'div',
        'span',
      ],
      attributes: { a: ['title'] },
      strip: [
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'svg',
        'math',
        'form',
        'input',
        'img',
        'video',
        'audio',
      ],
    },
  ],
]

export function InlineHtml({ source }: { source: string }) {
  if (source.length > 100_000) return <p>Markup unavailable. Read the source below.</p>
  return (
    <div className="min-w-0 overflow-x-auto [&_p]:my-1 [&_li]:ml-5 [&_ul]:list-disc [&_ol]:list-decimal [&_table]:border-collapse [&_td]:border [&_td]:border-[color:var(--border)] [&_td]:p-2 [&_th]:p-2 [&_a]:underline [&_pre]:whitespace-pre-wrap">
      <ReactMarkdown
        rehypePlugins={displayHtmlPlugins}
        components={{
          a: ({ children, title }) => <span title={title}>{children}</span>,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
