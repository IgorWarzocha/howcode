import type { Element } from 'hast'
import { BookOpen, Compass, Info, Lightbulb, ShieldCheck, Wrench } from 'lucide-react'

const answerIcons = {
  book: BookOpen,
  compass: Compass,
  info: Info,
  idea: Lightbulb,
  shield: ShieldCheck,
  wrench: Wrench,
}

export function answerIcon(src: string | undefined) {
  const name = src?.slice('howcode-icon/'.length)
  if (!(src?.startsWith('howcode-icon/') && name && Object.hasOwn(answerIcons, name))) {
    return null
  }
  return answerIcons[name as keyof typeof answerIcons]
}

export function isAnswerIconRow(node: Element | undefined) {
  const paragraph = node?.children[0]
  const first =
    paragraph?.type === 'element' && paragraph.tagName === 'p' ? paragraph.children[0] : paragraph
  return (
    first?.type === 'element' &&
    first.tagName === 'img' &&
    typeof first.properties.src === 'string' &&
    Boolean(answerIcon(first.properties.src))
  )
}
