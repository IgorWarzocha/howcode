import { Check, X } from 'lucide-react'
import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useDismissibleLayer } from '../hooks/useDismissibleLayer'
import { appToneDangerClass, appTypeMetaStrongClass, confirmPopoverClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { PopoverPanel } from './popover'

type ConfirmPopoverProps = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onConfirm: () => void | Promise<void>
  confirmLabel?: string
  cancelLabel?: string
  className?: string
}

export function ConfirmPopover({
  open,
  anchorRef,
  onClose,
  onConfirm,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  className,
}: ConfirmPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) setConfirming(false)
  }, [open])

  const handleConfirm = () => {
    if (confirming) return
    setConfirming(true)
    onClose()
    void Promise.resolve(onConfirm()).finally(() => setConfirming(false))
  }

  useDismissibleLayer({
    open,
    onDismiss: onClose,
    refs: [anchorRef, panelRef],
  })

  if (!open) {
    return null
  }

  return (
    <PopoverPanel
      ref={panelRef}
      surface={false}
      className={cn(confirmPopoverClass, className)}
      data-open="true"
    >
      <button
        type="button"
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md transition-[background-color,color,scale] duration-150 ease-out hover:bg-[color:color-mix(in_srgb,var(--danger-bg)_50%,transparent)] active:scale-[0.96] disabled:opacity-50',
          appTypeMetaStrongClass,
          appToneDangerClass,
        )}
        onClick={handleConfirm}
        disabled={confirming}
        aria-label={confirmLabel}
        title={confirmLabel}
      >
        <Check size={13} />
      </button>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-[background-color,color,scale] duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] active:scale-[0.96]"
        onClick={onClose}
        aria-label={cancelLabel}
        title={cancelLabel}
      >
        <X size={13} />
      </button>
    </PopoverPanel>
  )
}
