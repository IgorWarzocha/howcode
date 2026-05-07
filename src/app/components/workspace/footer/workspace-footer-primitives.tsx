import { cn } from '../../../utils/cn'
import { Tooltip } from '../../common/tooltip'

// Keep workspace bottom chrome visually in sync across the prompt composer,
// git-ops composer, and Pi-TUI takeover terminal footer.
export const workspaceFooterRowClass =
  'composer-footer-row flex items-center gap-1.5 pr-2.5 pl-2.5 py-2 text-[color:var(--muted)] max-md:flex-wrap'

export const workspaceFooterTrailingGroupClass =
  'ml-auto flex min-h-7 items-center gap-1.5 max-md:flex-wrap'

export const workspaceFooterTextClass = 'composer-footer-text'

type WorkspaceBranchChipProps = {
  branch: string | null | undefined
  className?: string
}

export function WorkspaceBranchChip({ branch, className }: WorkspaceBranchChipProps) {
  const label = branch ?? 'Detached'

  return (
    <Tooltip content={label}>
      <div
        className={cn(
          workspaceFooterTextClass,
          'inline-flex h-7 max-w-[12rem] items-center rounded-lg border border-transparent px-2.5 py-0 text-[color:var(--muted)] transition-colors duration-150 hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
          className,
        )}
      >
        <span className="truncate">{label}</span>
      </div>
    </Tooltip>
  )
}
