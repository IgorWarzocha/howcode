import { InlineChart } from './inline-chart'
import { InlineHtml } from './inline-html'
import { InlineMermaid } from './inline-mermaid'
import { InlineSvg } from './inline-svg'

export function InlineAnswerBlock({ language, source }: { language: string; source: string }) {
  switch (language) {
    case 'mermaid':
      return <InlineMermaid key={source} source={source} />
    case 'chart':
      return <InlineChart source={source} />
    case 'html':
      return <InlineHtml source={source} />
    case 'svg':
      return <InlineSvg source={source} />
    default:
      return null
  }
}
