import { Check, ShieldAlert, X } from 'lucide-react'
import { useState } from 'react'
import type { ProjectTrustRequest } from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeTinyClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type ProjectTrustCardProps = {
  request: ProjectTrustRequest
  onDecide: (trusted: boolean) => Promise<boolean> | boolean
}

const projectTrustCardClass =
  'relative grid w-full content-start rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-2.5 shadow-none'

export function ProjectTrustCard({ request, onDecide }: ProjectTrustCardProps) {
  const [busy, setBusy] = useState<false | 'trust' | 'untrust'>(false)

  const decide = async (trusted: boolean) => {
    if (busy) return
    setBusy(trusted ? 'trust' : 'untrust')
    const ok = await onDecide(trusted)
    if (!ok) setBusy(false)
  }

  return (
    <div className="grid w-full overflow-visible px-4">
      <div className={projectTrustCardClass}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2">
          <ShieldAlert size={15} className="text-[color:var(--accent)]" />
          <div className="grid min-w-0 gap-0.5">
            <div className={cn(appTypeGroupTextClass, appToneTextClass)}>Trust this project?</div>
            <div
              className={cn('truncate', appTypeMetaClass, appToneMutedClass)}
              title={request.cwd}
            >
              {request.cwd}
            </div>
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
    </div>
  )
}
