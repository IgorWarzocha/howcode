import { ShellTerminalViewport } from '@howcode/native-terminal'
import { PanelRightClose } from 'lucide-react'
import { type FeatureStatusId, getFeatureStatusDataAttributes } from '../features/feature-status'
import { compactIconButtonClass, terminalDrawerFooterClass } from '../ui/classes'
import { cn } from '../utils/cn'

export type ShellTerminalPanelProps = {
  projectId: string
  sessionPath: string | null
  onClose: () => void
  hoverToFocus?: boolean
  hoverToBlur?: boolean
}

export function ShellTerminalPanel({
  projectId,
  sessionPath,
  onClose,
  hoverToFocus = true,
  hoverToBlur = false,
}: ShellTerminalPanelProps) {
  const statusId: FeatureStatusId = 'feature:terminal.panel'

  return (
    <section
      aria-label="Terminal drawer"
      className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[color:var(--workspace)]"
      {...getFeatureStatusDataAttributes(statusId)}
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[color:var(--sidebar)]">
        <ShellTerminalViewport
          projectId={projectId}
          sessionPath={sessionPath}
          backgroundCssVar="--sidebar"
          hoverToFocus={hoverToFocus}
          hoverToBlur={hoverToBlur}
          className="terminal-viewport--flush !min-h-0 rounded-none bg-[color:var(--sidebar)]"
        />
      </div>
      <div className={terminalDrawerFooterClass}>
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            'h-7 w-7 rounded-md [&>svg]:h-[14px] [&>svg]:w-[14px]',
          )}
          aria-label="Hide terminal"
          onClick={onClose}
          data-tooltip="Hide terminal"
          data-tooltip-placement="left"
        >
          <PanelRightClose />
        </button>
      </div>
    </section>
  )
}
