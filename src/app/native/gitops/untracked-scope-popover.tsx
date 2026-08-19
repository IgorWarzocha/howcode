import { useEffect, useRef, useState } from 'react'
import { AnchoredPopoverPanel } from '../../common/popover'
import {
  appToneMutedClass,
  appTypeMetaClass,
  appTypeMetaStrongClass,
  composerPopoverExtensionLayerClass,
  composerPopoverPanelClass,
  composerTextActionButtonClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

export function UntrackedScopePopover({
  count,
  onInclude,
}: {
  count: number
  onInclude: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && rootRef.current?.contains(target)) return
      if (target instanceof Node && panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${composerTextActionButtonClass} border-0 bg-transparent text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`}
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
      >
        {count} untracked
      </button>
      <AnchoredPopoverPanel
        anchorRef={anchorRef}
        panelRef={panelRef}
        open={open}
        placement="top-center"
        portalClassName={composerPopoverExtensionLayerClass}
        surface={false}
        className={cn(composerPopoverPanelClass, 'w-64 p-2')}
      >
        <div className="grid gap-2 p-1">
          <div className="grid gap-0.5 px-1">
            <div className={appTypeMetaStrongClass}>Untracked files</div>
            <p className={cn(appTypeMetaClass, appToneMutedClass, 'm-0')}>
              {count} file{count === 1 ? ' is' : 's are'} not tracked by git.
            </p>
          </div>
          <button
            type="button"
            className="grid gap-0.5 rounded-md px-2 py-1.5 text-left text-[color:var(--text)] hover:bg-[color:var(--surface-hover)]"
            onClick={() => setOpen(false)}
          >
            <span className={appTypeMetaStrongClass}>Exclude from commit</span>
            <span className={cn(appTypeMetaClass, appToneMutedClass)}>
              Hide from the diff and leave untracked.
            </span>
          </button>
          <button
            type="button"
            className="grid gap-0.5 rounded-md px-2 py-1.5 text-left text-[color:var(--text)] hover:bg-[color:var(--surface-hover)]"
            onClick={() => {
              onInclude()
              setOpen(false)
            }}
          >
            <span className={appTypeMetaStrongClass}>Include in commit</span>
            <span className={cn(appTypeMetaClass, appToneMutedClass)}>
              Show in the diff and add when committing.
            </span>
          </button>
        </div>
      </AnchoredPopoverPanel>
    </span>
  )
}
