import { RotateCcw } from 'lucide-react'
import { Tooltip } from '../../../../../src/app/common/tooltip'
import { compactIconButtonClass } from '../../../../../src/app/ui/classes'

export function ChangeReviewResetButton({ onReset }: { onReset: () => void }) {
  return (
    <Tooltip content="Reset reviewed changes">
      <button
        type="button"
        className={compactIconButtonClass}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onReset()
        }}
        aria-label="Reset reviewed changes"
      >
        <RotateCcw size={13} />
      </button>
    </Tooltip>
  )
}
