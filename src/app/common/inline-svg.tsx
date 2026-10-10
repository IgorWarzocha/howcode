import { sanitizeInlineSvg } from './sanitize-inline-svg'

export function InlineSvg({ source, label }: { source: string; label?: string }) {
  const svg = sanitizeInlineSvg(source)
  if (!svg) return <p>Illustration unavailable. Read the source below.</p>
  const title = new DOMParser()
    .parseFromString(svg, 'image/svg+xml')
    .querySelector('title')?.textContent
  return (
    <img
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
      alt={label || title || 'Inline illustration. Read the source for details.'}
      className="block h-auto max-h-[32rem] max-w-full"
    />
  )
}
