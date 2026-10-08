import { useDismissibleLayer } from '@howaboua/howcode-sdk/hooks/useDismissibleLayer'
import { useRef } from 'react'

export function useDirectoryMenuDismiss(open: boolean, onDismiss: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)

  useDismissibleLayer({
    open,
    onDismiss,
    refs: [containerRef],
  })

  return {
    containerRef,
  }
}
