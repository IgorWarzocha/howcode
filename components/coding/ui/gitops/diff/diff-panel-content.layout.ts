export function alignElementInScrollViewport({
  scrollContainer,
  targetElement,
  mode,
}: {
  scrollContainer: HTMLDivElement
  targetElement: HTMLElement
  mode: 'center' | 'draft-fit'
}) {
  const containerRect = scrollContainer.getBoundingClientRect()
  const targetRect = targetElement.getBoundingClientRect()

  if (mode === 'draft-fit') {
    const viewportPadding = 8
    const availableHeight = containerRect.height - viewportPadding * 2

    if (targetRect.height <= availableHeight) {
      const bottomOverflow = targetRect.bottom - (containerRect.bottom - viewportPadding)
      const topOverflow = containerRect.top + viewportPadding - targetRect.top

      if (bottomOverflow > 0) {
        scrollContainer.scrollTop += bottomOverflow
        return
      }

      if (topOverflow > 0) {
        scrollContainer.scrollTop -= topOverflow
      }
      return
    }

    const desiredVisibleDraftHeight = Math.min(120, targetRect.height)
    const desiredDraftTop = containerRect.bottom - desiredVisibleDraftHeight
    const bottomOverflow = targetRect.top - desiredDraftTop
    const topOverflow = containerRect.top + viewportPadding - targetRect.top

    if (bottomOverflow > 0) {
      scrollContainer.scrollTop += bottomOverflow + 6
      return
    }

    if (topOverflow > 0) {
      scrollContainer.scrollTop -= topOverflow
    }
    return
  }

  const desiredTargetTop = containerRect.top + (containerRect.height - targetRect.height) / 2
  const offset = targetRect.top - desiredTargetTop

  if (Math.abs(offset) > 4) {
    scrollContainer.scrollTop += offset
  }
}
