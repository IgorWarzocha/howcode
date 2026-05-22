import { appToneSubtleClass, appTypeGroupTextClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'

export function EmptyThreadsState() {
  return (
    <div className={cn('px-2.5 py-2', appTypeGroupTextClass, appToneSubtleClass)}>No threads</div>
  )
}
