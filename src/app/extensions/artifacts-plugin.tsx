import { FileCode2 } from 'lucide-react'
import { lazy } from 'react'
import { ToolbarButton } from '../common/toolbar-button'
import { iconActionButtonDisabledClass } from '../ui/classes'
import { cn } from '../utils/cn'
import { workspaceFooterTextClass } from '../workspace-shell/footer/workspace-footer-primitives'
import { useToolkitExtensionEnabled } from './toolkit-context'

export const ArtifactWorkspacePanel = lazy(() =>
  import('@howcode/native-artifacts').then((module) => ({ default: module.ArtifactPanel })),
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
  const enabled = useToolkitExtensionEnabled('artifacts')
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
