import { Code2 } from 'lucide-react'
import { appToneMutedClass, appTypeControlClass, quietEmptyStateClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

export function SidebarProjectsPlaceholder() {
  return (
    <div
      className={cn(
        quietEmptyStateClass,
        'grid min-h-24 place-items-center gap-1.5 text-center',
        appTypeControlClass,
        appToneMutedClass,
      )}
    >
      <Code2 size={15} className="text-[color:var(--muted-2)]" />
      <span>Projects live in Code</span>
    </div>
  )
}
