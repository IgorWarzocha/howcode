import { ArrowUpRight, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { CompactMetaRow } from '../../common/compact-meta-row'
import { ConfirmPopover } from '../../common/confirm-popover'
import { Tooltip } from '../../common/tooltip'
import type { PiConfiguredPackage } from '../../desktop/types'
import { openPiResourceUrl } from '../../pi-resources/open-pi-resource-url'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  viewCloseButtonClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import {
  getConfiguredPackageExternalUrl,
  getConfiguredSourceLabel,
  isConfiguredSourcePath,
} from '../utils'

type ConfiguredPackageRowProps = {
  configuredPackage: PiConfiguredPackage
  removePending: boolean
  onRemove: (configuredPackage: PiConfiguredPackage) => void
}

export function ConfiguredPackageRow({
  configuredPackage,
  removePending,
  onRemove,
}: ConfiguredPackageRowProps) {
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const removeButtonRef = useRef<HTMLButtonElement>(null)
  const sourceLabel = getConfiguredSourceLabel(configuredPackage)
  const externalUrl = getConfiguredPackageExternalUrl(configuredPackage)

  return (
    <CompactMetaRow
      density="dense"
      contentClassName={`grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-1.5 overflow-hidden ${appTypeGroupTextClass}`}
      actions={
        configuredPackage.resourceKind === 'package' ? (
          <div className="relative">
            <Tooltip content={removePending ? 'Removing' : 'Remove'}>
              <button
                type="button"
                ref={removeButtonRef}
                className={cn(viewCloseButtonClass, 'hover:text-[color:var(--danger)]')}
                onClick={() => {
                  if (removePending) return
                  setConfirmRemoveOpen((current) => !current)
                }}
                disabled={removePending}
                aria-label={removePending ? 'Removing' : 'Remove'}
              >
                <Trash2 size={13} />
              </button>
            </Tooltip>

            <ConfirmPopover
              open={confirmRemoveOpen}
              anchorRef={removeButtonRef}
              onClose={() => setConfirmRemoveOpen(false)}
              onConfirm={() => void onRemove(configuredPackage)}
            />
          </div>
        ) : null
      }
    >
      {externalUrl ? (
        <Tooltip content={externalUrl} contentClassName="max-w-[420px]">
          <button
            type="button"
            className="group inline-flex shrink-0 items-center gap-0.5 p-0"
            onClick={() => void openPiResourceUrl(externalUrl)}
            aria-label={`Open ${configuredPackage.displayName}`}
          >
            <span
              className={cn(
                `${appTypeGroupTextClass} ${appToneTextClass}`,
                'transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]',
              )}
            >
              {configuredPackage.displayName}
            </span>
            <ArrowUpRight
              size={12}
              className="shrink-0 text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
            />
          </button>
        </Tooltip>
      ) : (
        <span className={`${appTypeGroupTextClass} ${appToneTextClass}`}>
          {configuredPackage.displayName}
        </span>
      )}
      <div
        className={cn(
          `${appTypeGroupTextClass} ${appToneMutedClass}`,
          isConfiguredSourcePath(configuredPackage) ? 'min-w-0 truncate' : 'shrink-0',
        )}
      >
        {sourceLabel}
      </div>
    </CompactMetaRow>
  )
}
