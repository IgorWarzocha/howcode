import { workspaceFooterTextClass } from '@howaboua/howcode-sdk/ui/footer-primitives'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { Terminal } from 'lucide-react'
import { ToolbarButton } from '../../../src/app/common/toolbar-button'
import { useToolkitComponentEnabled } from '../../../src/app/component-system/component-context'

export function TerminalComposerControl({
  visible,
  onToggle,
}: {
  visible: boolean
  onToggle: () => void
}) {
  const enabled = useToolkitComponentEnabled('terminal')
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
