import { Terminal } from 'lucide-react'
import { ToolbarButton } from '../../../src/app/common/toolbar-button'
import { useToolkitExtensionEnabled } from '../../../src/app/extensions/toolkit-context'
import { cn } from '../../../src/app/utils/cn'
import { workspaceFooterTextClass } from '../../../src/app/workspace-shell/footer/workspace-footer-primitives'

export function TerminalComposerControl({
  visible,
  onToggle,
}: {
  visible: boolean
  onToggle: () => void
}) {
  const enabled = useToolkitExtensionEnabled('terminal')
  if (!enabled) return null
  return (
    <ToolbarButton
      label="Terminal"
      icon={<Terminal size={14} />}
      onClick={onToggle}
      className={cn(
        workspaceFooterTextClass,
        'composer-terminal-control',
        visible && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
      )}
    />
  )
}
