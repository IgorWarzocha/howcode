import { FileCode2 } from 'lucide-react'
import { lazy } from 'react'
import { ToolbarButton } from '../../../src/app/common/toolbar-button'
import { useToolkitComponentEnabled } from '../../../src/app/component-system/component-context'
import { iconActionButtonDisabledClass } from '../../../src/app/ui/classes'
import { cn } from '../../../src/app/utils/cn'
import { workspaceFooterTextClass } from '../../../src/app/workspace-shell/footer/workspace-footer-primitives'

export const ArtifactWorkspacePanel = lazy(() =>
  import('./panel/index').then((module) => ({ default: module.ArtifactPanel })),
)

export function ArtifactsComposerControl({
  available,
  visible,
  onToggle,
}: {
  available: boolean
  visible: boolean
  onToggle?: (() => void) | undefined
}) {
  const enabled = useToolkitComponentEnabled('artifacts')
  if (!enabled) return null
  const disabled = !(available && onToggle)
  return (
    <ToolbarButton
      label="Artifacts"
      icon={<FileCode2 size={14} />}
      trailing
      className={cn(
        workspaceFooterTextClass,
        iconActionButtonDisabledClass,
        visible && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
      )}
      onClick={onToggle}
      disabled={disabled}
      aria-disabled={disabled}
    />
  )
}
