import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { PluggableList } from 'unified'

// Hotfix: allow common assistant-emitted HTML such as <br>, <kbd>, and <details>
// while still sanitizing raw HTML. This may get reworked into a smaller explicit
// markdown extension once we have a firmer policy for rendered HTML.
const markdownHtmlSanitizeSchema = { ...defaultSchema }

export const markdownHtmlRehypePlugins = [
  rehypeRaw,
  [rehypeSanitize, markdownHtmlSanitizeSchema],
] satisfies PluggableList
