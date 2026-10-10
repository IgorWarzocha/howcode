import type { ImgHTMLAttributes } from 'react'
import { answerIcon } from './answer-icon-source'

export function AnswerImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const Icon = answerIcon(src)
  if (Icon) {
    return (
      <Icon
        size={18}
        aria-hidden="true"
        className="inline-block align-text-bottom text-[color:var(--muted)]"
      />
    )
  }
  // Unknown icon names remain text, never a network request for a host marker.
  if (src?.startsWith('howcode-icon/')) return <span>{alt || 'Icon'}</span>
  return <img {...props} src={src} alt={alt} />
}
