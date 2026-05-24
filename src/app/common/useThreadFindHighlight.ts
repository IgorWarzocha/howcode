import { type RefObject, useEffect } from 'react'

const threadFindHighlightName = 'thread-find-match'

function collectFindHighlightRanges(root: HTMLElement, query: string) {
  const ranges: Range[] = []
  const normalizedQuery = query.toLowerCase()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent?.textContent) return NodeFilter.FILTER_REJECT
      if (parent.closest('button, input, textarea, select, [data-no-find-highlight="true"]')) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = node.textContent ?? ''
    const normalizedText = text.toLowerCase()
    let index = normalizedText.indexOf(normalizedQuery)
    while (index !== -1) {
      const range = document.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + query.length)
      ranges.push(range)
      index = normalizedText.indexOf(normalizedQuery, index + query.length)
    }
  }

  return ranges
}

export function useThreadFindHighlight(input: {
  active: boolean | undefined
  query: string | undefined
  rootRef: RefObject<HTMLDivElement | null>
}) {
  useEffect(() => {
    if (!('Highlight' in window && 'highlights' in CSS)) return
    const root = input.rootRef.current
    const query = input.query?.trim()
    if (!(input.active && root && query)) {
      CSS.highlights.delete(threadFindHighlightName)
      return
    }

    CSS.highlights.set(
      threadFindHighlightName,
      new Highlight(...collectFindHighlightRanges(root, query)),
    )
    return () => {
      CSS.highlights.delete(threadFindHighlightName)
    }
  }, [input.active, input.query, input.rootRef])
}
