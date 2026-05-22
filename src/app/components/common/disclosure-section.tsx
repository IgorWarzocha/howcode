import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PropsWithChildren, ReactNode } from 'react'
import { disclosureButtonClass } from '../../ui/classes'
import { cn } from '../../utils/cn'

type DisclosureSectionProps = PropsWithChildren<{
  title: ReactNode
  open: boolean
  onToggle: () => void
  actions?: ReactNode
  actionsClassName?: string
  className?: string
  contentClassName?: string
  forceMountContent?: boolean
  chevronPosition?: 'left' | 'right'
}>

export function DisclosureSection({
  title,
  open,
  onToggle,
  actions,
  actionsClassName,
  className,
  contentClassName,
  forceMountContent,
  chevronPosition = 'left',
  children,
}: DisclosureSectionProps) {
  const chevron = open ? <ChevronDown size={14} /> : <ChevronRight size={14} />

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className={disclosureButtonClass}
          onClick={onToggle}
          aria-expanded={open}
        >
          {chevronPosition === 'left' ? chevron : null}
          <span>{title}</span>
          {chevronPosition === 'right' ? chevron : null}
        </button>
        {actions ? <div className={cn('shrink-0', actionsClassName)}>{actions}</div> : null}
      </div>

      {open || forceMountContent ? <div className={contentClassName}>{children}</div> : null}
    </div>
  )
}
