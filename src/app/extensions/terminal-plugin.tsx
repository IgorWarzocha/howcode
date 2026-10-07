import { Terminal } from 'lucide-react'
import { ToolbarButton } from '../common/toolbar-button'
import { cn } from '../utils/cn'
import { workspaceFooterTextClass } from '../workspace-shell/footer/workspace-footer-primitives'
import { useToolkitExtensionEnabled } from './toolkit-context'

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
