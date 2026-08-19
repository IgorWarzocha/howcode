import type { ReactNode, RefObject } from 'react'
import { cn } from '../utils/cn'

export type ComposerOverlayStackItem = {
  id: string
  node: ReactNode
  visible: boolean
}

export function ComposerOverlayStack({
  items,
  stackRef,
}: {
  items: ComposerOverlayStackItem[]
  stackRef: RefObject<HTMLDivElement | null>
}) {
  const visibleItems = items.filter((item) => item.visible)
  return (
    <div
      ref={stackRef}
      className={cn(
        'pointer-events-none absolute right-0 bottom-full left-0 z-[120] grid max-h-[min(70vh,42rem)] min-w-0 overflow-hidden',
        visibleItems.length === 0 && 'invisible h-0 min-h-0 overflow-hidden',
      )}
    >
      {visibleItems.map((item, index) => (
        <div
          key={item.id}
          className={cn('pointer-events-auto min-h-0 min-w-0', index > 0 && '-mt-px')}
        >
          {item.node}
        </div>
      ))}
    </div>
  )
}
