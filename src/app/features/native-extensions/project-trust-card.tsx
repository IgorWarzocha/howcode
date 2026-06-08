import { Shield, ShieldAlert } from 'lucide-react'
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
  'relative grid w-full content-start gap-2 rounded-t-lg rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-3 pt-2.5 pb-3.5 shadow-none'

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
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 px-2">
          <ShieldAlert size={15} className="mt-0.5 text-[color:var(--accent)]" />
          <div className="grid min-w-0 gap-0.5">
            <div className={cn(appTypeGroupTextClass, appToneTextClass)}>Trust this project?</div>
            <div
              className={cn('truncate', appTypeMetaClass, appToneMutedClass)}
              title={request.cwd}
            >
              {request.cwd}
            </div>
          </div>
        </div>

        <div className={cn('px-2', appTypeTinyClass, appToneMutedClass)}>
          Project-local settings, packages, skills, prompts and instructions are disabled until you
          trust it.
        </div>

        <div className="flex justify-end gap-1.5 px-2 pt-1">
          <button
            type="button"
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 transition-colors hover:bg-[color:var(--surface-hover)] disabled:opacity-55',
              appTypeTinyClass,
              appToneMutedClass,
            )}
            disabled={Boolean(busy)}
            onClick={() => void decide(false)}
          >
            Keep untrusted
          </button>
          <button
            type="button"
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md bg-[color:var(--surface-hover)] px-2.5 text-[color:var(--text)] transition-colors hover:bg-[color:var(--panel-3)] disabled:opacity-55',
              appTypeTinyClass,
            )}
            disabled={Boolean(busy)}
            onClick={() => void decide(true)}
          >
            <Shield size={12} />
            Trust project
          </button>
        </div>
      </div>
    </div>
  )
}
