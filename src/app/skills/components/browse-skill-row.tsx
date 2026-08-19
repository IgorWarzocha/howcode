import { ArrowUpRight, Check, Sparkles } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { CompactMetaRow } from '../../common/compact-meta-row'
import { Tooltip } from '../../common/tooltip'
import { openPiResourceUrl } from '../../pi-resources/open-pi-resource-url'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  viewCloseButtonClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SkillCatalogItem } from '../skill-catalog'
import { formatInstalls, getCatalogSkillSource } from '../utils'

export function BrowseSkillRow({
  installed,
  isPendingInstall,
  item,
  selected,
  setSelectedSources,
}: {
  installed: boolean
  isPendingInstall: (source: string) => boolean
  item: SkillCatalogItem
  selected: boolean
  setSelectedSources: Dispatch<SetStateAction<string[]>>
}) {
  const pendingInstall = isPendingInstall(getCatalogSkillSource(item))
  const selectionLabel = selected ? `Deselect ${item.name}` : `Select ${item.name} for install`
  return (
    <CompactMetaRow
      selected={selected}
      density="dense"
      actions={
        <BrowseSkillRowActions
          installed={installed}
          item={item}
          pendingInstall={pendingInstall}
          selected={selected}
          selectionLabel={selectionLabel}
          setSelectedSources={setSelectedSources}
        />
      }
      contentClassName={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-baseline gap-1.5 overflow-hidden ${appTypeGroupTextClass}`}
    >
      <Tooltip content={item.url} contentClassName="max-w-[420px]">
        <button
          type="button"
          className="group inline-flex shrink-0 items-center gap-0.5 p-0"
          onClick={() => void openPiResourceUrl(item.url)}
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
      <div className={cn(`${appTypeGroupTextClass} ${appToneMutedClass}`, 'min-w-0 truncate')}>
        {item.description || item.source}
      </div>
      <span
        className={cn(
          `${appTypeGroupTextClass} ${appToneMutedClass}`,
          'shrink-0 whitespace-nowrap tabular-nums',
        )}
      >
        {formatInstalls(item.installs)}
      </span>
      {installed ? (
        <span
          className={cn(
            `${appTypeGroupTextClass} ${appToneMutedClass}`,
            'shrink-0 whitespace-nowrap',
          )}
        >
          Installed
        </span>
      ) : null}
    </CompactMetaRow>
  )
}

function BrowseSkillRowActions({
  installed,
  item,
  pendingInstall,
  selected,
  selectionLabel,
  setSelectedSources,
}: {
  installed: boolean
  item: SkillCatalogItem
  pendingInstall: boolean
  selected: boolean
  selectionLabel: string
  setSelectedSources: Dispatch<SetStateAction<string[]>>
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
        onClick={() => {
          setSelectedSources((current) =>
            current.includes(item.identityKey)
              ? current.filter((source) => source !== item.identityKey)
              : [...current, item.identityKey],
          )
        }}
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
