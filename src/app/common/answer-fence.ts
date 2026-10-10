import type { Element } from 'hast'

const openingFencePattern = /^ {0,3}(`{3,}|~{3,})[^\n]*\n/

export function isClosedAnswerFence(markdown: string, node: Element | undefined) {
  const start = node?.position?.start.offset
  const end = node?.position?.end.offset
  if (start === undefined || end === undefined) return false
  const source = markdown.slice(start, end)
  const opening = openingFencePattern.exec(source)?.[1]
  if (!opening) return false
  const lastLine = source.slice(source.lastIndexOf('\n') + 1).trim()
  return lastLine.length >= opening.length && [...lastLine].every((char) => char === opening[0])
}

export function supportsInlineAnswer(language: string | null) {
  return language === 'mermaid' || language === 'chart' || language === 'html' || language === 'svg'
}
