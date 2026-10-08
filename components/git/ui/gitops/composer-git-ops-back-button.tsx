import { ArrowLeft } from 'lucide-react'
import { useRef } from 'react'
import { useDismissibleLayer } from '../../../../src/app/hooks/useDismissibleLayer'
import {
  compactIconButtonClass,
  composerInlineConfirmButtonClass,
} from '../../../../src/app/ui/classes'
import { cn } from '../../../../src/app/utils/cn'
import type { WorkspacePresentationCloseConfirmation } from '../../../../src/app/workspace-shell/workspace-presentation'

export function ComposerGitOpsBackButton({
  hasPendingReview,
  onBack,
  onDiscardReview,
  closeConfirmation,
}: {
  hasPendingReview: boolean
  onBack: () => void
  onDiscardReview: () => void
  closeConfirmation: WorkspacePresentationCloseConfirmation
}) {
  const { open: confirmingDiscard, setOpen: setConfirmingDiscard } = closeConfirmation
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useDismissibleLayer({
    open: confirmingDiscard,
    onDismiss: () => setConfirmingDiscard(false),
    refs: [backButtonRef, confirmButtonRef],
  })

  const discardAndBack = () => {
    onDiscardReview()
    setConfirmingDiscard(false)
    onBack()
  }

  return (
    <>
      <button
        ref={backButtonRef}
        type="button"
        className={cn(compactIconButtonClass, 'h-7 w-7')}
        onClick={() => {
          if (confirmingDiscard) return discardAndBack()
          if (hasPendingReview) return setConfirmingDiscard(true)
          onBack()
        }}
        aria-label="Back"
        data-tooltip="Back"
      >
        <ArrowLeft size={14} />
      </button>
      {confirmingDiscard ? (
        <button
          ref={confirmButtonRef}
          type="button"
          className={composerInlineConfirmButtonClass}
          data-open="true"
          onClick={discardAndBack}
        >
          Go back and discard comments?
        </button>
      ) : null}
    </>
  )
}
