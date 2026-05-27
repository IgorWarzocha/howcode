import { ArrowUpRight, Check, Sparkles } from 'lucide-react'
import { CompactMetaRow } from '../../common/compact-meta-row'
import { Tooltip } from '../../common/tooltip'
import type { PiPackageCatalogItem } from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  viewCloseButtonClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import { formatDownloads, openExternalUrl, pickSafeExternalUrl } from '../utils'

type CatalogItemRowProps = {
  item: PiPackageCatalogItem
  selected: boolean
  installed: boolean
  pendingInstall: boolean
  onToggleSelected: (source: string) => void
}

export function CatalogItemRow({
  item,
  selected,
  installed,
  pendingInstall,
  onToggleSelected,
}: CatalogItemRowProps) {
  const externalUrl = pickSafeExternalUrl([item.repositoryUrl, item.homepageUrl, item.npmUrl])
  const selectionLabel = selected ? `Deselect ${item.name}` : `Select ${item.name} for install`

  return (
    <CompactMetaRow
      selected={selected}
      density="dense"
      actions={
        <CatalogItemRowActions
          installed={installed}
          item={item}
          pendingInstall={pendingInstall}
          selected={selected}
          selectionLabel={selectionLabel}
          onToggleSelected={onToggleSelected}
        />
      }
      contentClassName={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-baseline gap-1.5 overflow-hidden ${appTypeGroupTextClass}`}
    >
      {externalUrl ? (
        <Tooltip content={externalUrl} contentClassName="max-w-[420px]">
          <button
            type="button"
            className="group inline-flex shrink-0 items-center gap-0.5 p-0"
            onClick={() => void openExternalUrl(externalUrl)}
            aria-label={`Open ${item.name}`}
          >
            <span
              className={cn(
                `${appTypeGroupTextClass} ${appToneTextClass}`,
                'transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]',
              )}
            >
              {item.name}
            </span>
            <ArrowUpRight
              size={12}
              className="shrink-0 text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
            />
          </button>
        </Tooltip>
      ) : (
        <span className={`${appTypeGroupTextClass} ${appToneTextClass}`}>{item.name}</span>
      )}
      <div className={`${appTypeGroupTextClass} ${appToneMutedClass} min-w-0 truncate`}>
        {item.description || item.source}
      </div>
      <span
        className={`${appTypeGroupTextClass} ${appToneMutedClass} shrink-0 whitespace-nowrap tabular-nums`}
      >
        {formatDownloads(item.monthlyDownloads)}
      </span>
      <span className={`${appTypeGroupTextClass} ${appToneMutedClass} shrink-0 whitespace-nowrap`}>
        v{item.version}
      </span>
      {installed ? (
        <span
          className={`${appTypeGroupTextClass} ${appToneMutedClass} shrink-0 whitespace-nowrap`}
        >
          Installed
        </span>
      ) : null}
    </CompactMetaRow>
  )
}

function CatalogItemRowActions({
  installed,
  item,
  pendingInstall,
  selected,
  selectionLabel,
  onToggleSelected,
}: {
  installed: boolean
  item: PiPackageCatalogItem
  pendingInstall: boolean
  selected: boolean
  selectionLabel: string
  onToggleSelected: (source: string) => void
}) {
  if (pendingInstall) {
    return (
      <output
        className="inline-flex h-7 w-7 items-center justify-center text-[color:var(--muted)]"
        aria-label={`Installing ${item.name}`}
      >
        <Sparkles size={14} />
      </output>
    )
  }
  if (installed) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center text-[color:var(--muted)]"
        role="img"
        aria-label={`${item.name} installed`}
      >
        <Check size={14} strokeWidth={2.4} />
      </span>
    )
  }
  return (
    <Tooltip content={selectionLabel}>
      <button
        type="button"
        className={viewCloseButtonClass}
        onClick={() => onToggleSelected(item.source)}
        aria-pressed={selected}
        aria-label={selectionLabel}
      >
        <span
          className={cn(
            'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-[color:var(--muted-2)] bg-transparent transition-colors',
            selected && 'border-[color:var(--accent-border)] text-[color:var(--text)]',
          )}
        >
          {selected ? <Check size={9} strokeWidth={2.6} /> : null}
        </span>
      </button>
    </Tooltip>
  )
}
