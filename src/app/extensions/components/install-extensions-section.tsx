import { CornerDownLeft, PackagePlus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Tooltip } from '../../common/tooltip'
import {
  appToneMutedClass,
  appTypeGroupTextClass,
  iconActionButtonDisabledClass,
  quietSearchInputClass,
  sectionHeadingClass,
  viewCloseButtonClass,
} from '../../ui/classes'
import { skillsActionColumnClass, skillsActionControlRowClass } from '../../ui/screen-classes'
import { cn } from '../../utils/cn'
import type { InstallScope, ManualSourceKind } from '../types'

type InstallExtensionsSectionProps = {
  installScope: InstallScope
  projectScopeAvailable: boolean
  hasPendingInstall: boolean
  isInstallPending: (source: string) => boolean
  onInstall: (source: string, kind: ManualSourceKind) => Promise<boolean>
}

const sourceKindOptions = [
  { value: 'npm', label: 'npm' },
  { value: 'git', label: 'git' },
] as const

export function InstallExtensionsSection({
  installScope,
  projectScopeAvailable,
  hasPendingInstall,
  isInstallPending,
  onInstall,
}: InstallExtensionsSectionProps) {
  const [manualSource, setManualSource] = useState('')
  const [manualSourceKind, setManualSourceKind] = useState<ManualSourceKind>('npm')
  const hasManualSource = manualSource.trim().length > 0
  const manualInstallPending = hasManualSource && isInstallPending(manualSource)
  const disabled =
    (!projectScopeAvailable && installScope === 'project') ||
    !hasManualSource ||
    manualInstallPending ||
    hasPendingInstall

  const installManualSource = async () => {
    const source = manualSource.trim()
    if (!source) return
    if (await onInstall(source, manualSourceKind)) setManualSource('')
  }

  return (
    <section className="grid gap-2">
      <div className={sectionHeadingClass}>Install</div>

      <form
        className={skillsActionControlRowClass}
        onSubmit={(event) => {
          event.preventDefault()
          void installManualSource()
        }}
      >
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-1">
          <fieldset className="m-0 inline-flex min-w-0 items-center gap-1 border-0 p-0">
            <legend className="sr-only">Extension source type</legend>
            {sourceKindOptions.map((option) => {
              const selected = manualSourceKind === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    `rounded-md px-2 py-0.5 ${appTypeGroupTextClass} ${appToneMutedClass} transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]`,
                    selected && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
                  )}
                  aria-pressed={selected}
                  onClick={() => setManualSourceKind(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </fieldset>

          <div className="relative min-w-0">
            <input
              type="text"
              value={manualSource}
              onChange={(event) => setManualSource(event.target.value)}
              className={cn(quietSearchInputClass, 'w-full pr-7')}
              placeholder={
                manualSourceKind === 'npm'
                  ? 'Package name or npm:@scope/pkg'
                  : 'git:github.com/user/repo or https://…'
              }
              aria-label={
                manualSourceKind === 'npm' ? 'Install npm package' : 'Install git package'
              }
            />
            <Tooltip content="Press Enter to install">
              <button
                type="submit"
                className="absolute inset-y-0 right-2 flex items-center justify-center text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled}
                aria-label={hasManualSource ? `Install ${manualSourceKind} source` : 'Install'}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center">
                  <CornerDownLeft size={12} strokeWidth={2} className="block" />
                </span>
              </button>
            </Tooltip>
          </div>
        </div>

        <div className={skillsActionColumnClass}>
          <Tooltip content={hasManualSource ? `Install ${manualSourceKind} source` : 'Install'}>
            <button
              type="submit"
              className={cn(viewCloseButtonClass, iconActionButtonDisabledClass)}
              disabled={disabled}
              aria-label={hasManualSource ? `Install ${manualSourceKind} source` : 'Install'}
            >
              {manualInstallPending ? <Sparkles size={14} /> : <PackagePlus size={14} />}
            </button>
          </Tooltip>
        </div>
      </form>
    </section>
  )
}
