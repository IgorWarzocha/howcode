import { Check, X } from 'lucide-react'
import { useState } from 'react'
import type { ProjectTrustRequest } from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeTinyClass,
  nativeExtensionTextClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type ProjectTrustCardProps = {
  request: ProjectTrustRequest
  embedded?: boolean | undefined
  onDecide: (trusted: boolean) => Promise<boolean> | boolean
}

const projectTrustCardClass =
  'relative grid w-full content-start rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-2.5 shadow-none'
const projectTrustContentClass = `relative grid w-full content-start ${nativeExtensionTextClass}`

export function ProjectTrustCard({ request, embedded = false, onDecide }: ProjectTrustCardProps) {
  const [busy, setBusy] = useState<false | 'trust' | 'untrust'>(false)

  const decide = async (trusted: boolean) => {
    if (busy) return
    setBusy(trusted ? 'trust' : 'untrust')
    const ok = await onDecide(trusted)
    if (!ok) setBusy(false)
  }

  const content = (
    <div className={embedded ? projectTrustContentClass : projectTrustCardClass}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={cn('shrink-0', appTypeGroupTextClass, appToneTextClass)}>
            Trust this project?
          </span>
          <span className={cn('truncate', appTypeMetaClass, appToneMutedClass)} title={request.cwd}>
            {request.cwd}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Keep project untrusted"
            title="Keep untrusted"
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-55',
              appTypeTinyClass,
            )}
            disabled={Boolean(busy)}
            onClick={() => void decide(false)}
          >
            <X size={13} />
          </button>
          <button
            type="button"
            aria-label="Trust project"
            title="Trust project"
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--surface-hover)] text-[color:var(--text)] transition-colors hover:bg-[color:var(--panel-3)] disabled:opacity-55',
              appTypeTinyClass,
            )}
            disabled={Boolean(busy)}
            onClick={() => void decide(true)}
          >
            <Check size={13} />
          </button>
        </div>
      </div>
    </div>
  )

  return embedded ? content : <div className="grid w-full overflow-visible px-4">{content}</div>
}
