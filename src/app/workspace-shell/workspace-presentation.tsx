import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { mainPanelClass } from '@howcode/ui/classes'
import { type ReactNode, useState } from 'react'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../ui/layout'

export type WorkspacePresentationCloseConfirmation = {
  open: boolean
  setOpen: (open: boolean) => void
}

export function useWorkspacePresentationToggle({
  id,
  open,
  confirmClose,
  onOpen,
  onClose,
}: {
  id: string
  open: boolean
  confirmClose: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const [confirmationId, setConfirmationId] = useState<string | null>(null)
  const close = () => {
    setConfirmationId(null)
    onClose()
  }
  return {
    close,
    toggle: () => {
      if (!open) onOpen()
      else if (confirmClose) setConfirmationId(id)
      else close()
    },
    closeConfirmation: {
      open: open && confirmationId === id,
      setOpen: (requested: boolean) => setConfirmationId(requested ? id : null),
    },
  }
}

export function WorkspacePresentation({
  children,
  flush = false,
}: {
  children: ReactNode
  flush?: boolean
}) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          'motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden',
          WORKSPACE_EDGE_PADDING_CLASS,
        )}
        style={{ bottom: '0px' }}
      >
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden">
          <main className={flush ? 'min-h-0 overflow-hidden' : mainPanelClass}>{children}</main>
        </div>
      </div>
    </div>
  )
}
