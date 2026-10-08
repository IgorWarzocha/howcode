import { workspaceFooterTextClass } from '@howaboua/howcode-sdk/ui/footer-primitives'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { iconActionButtonDisabledClass } from '@howcode/ui/classes'
import { FileCode2 } from 'lucide-react'
import { lazy } from 'react'
import { ToolbarButton } from '../../../src/app/common/toolbar-button'
import { useToolkitComponentEnabled } from '../../../src/app/component-system/component-context'

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
