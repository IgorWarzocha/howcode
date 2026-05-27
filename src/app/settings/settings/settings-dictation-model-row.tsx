import { Check, Download, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { ActivitySpinner } from '../../common/activity-spinner'
import type { DictationModelId, DictationModelSummary } from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  appTypeMetaClass,
  appTypeSmallClass,
  appTypeTinyClass,
  composerTextActionButtonClass,
  settingsListRowClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { DictationPendingAction } from './useSettingsDictationController'

function ModelActionButton({
  disabled = false,
  primary = false,
  onClick,
  label,
  icon,
}: {
  disabled?: boolean
  primary?: boolean
  onClick: () => void
  label: string
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        composerTextActionButtonClass,
        `min-h-7 gap-1 rounded-lg px-2.5 ${appTypeMetaClass}`,
        primary && 'border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)]',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function PendingActionIcon({ active, fallback }: { active: boolean; fallback: ReactNode }) {
  return active ? <ActivitySpinner className="h-3 w-3 text-current" /> : fallback
}

function InstalledModelActions({
  anyPending,
  model,
  pendingAction,
  onDelete,
  onUse,
}: Pick<
  Parameters<typeof SettingsDictationModelRow>[0],
  'anyPending' | 'model' | 'pendingAction' | 'onDelete' | 'onUse'
>) {
  if (model.selected) {
    return (
      <div
        className={`inline-flex min-h-7 items-center gap-1 rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)] px-2.5 ${appTypeMetaClass} ${appToneTextClass}`}
      >
        <Check size={11} />
        <span>In use</span>
      </div>
    )
  }

  return (
    <>
      <ModelActionButton
        disabled={anyPending}
        label={pendingAction === 'switch' ? 'Switching…' : 'Use'}
        icon={
          <PendingActionIcon active={pendingAction === 'switch'} fallback={<Check size={11} />} />
        }
        onClick={onUse}
      />
      {model.managed ? (
        <ModelActionButton
          disabled={anyPending}
          label={pendingAction === 'delete' ? 'Deleting…' : 'Delete'}
          icon={
            <PendingActionIcon
              active={pendingAction === 'delete'}
              fallback={<Trash2 size={11} />}
            />
          }
          onClick={onDelete}
        />
      ) : null}
    </>
  )
}

export function SettingsDictationModelRow({
  activeModelId,
  model,
  pendingAction,
  anyPending,
  onDelete,
  onDownload,
  onUse,
}: {
  activeModelId: DictationModelId | null
  model: DictationModelSummary
  pendingAction: DictationPendingAction['kind'] | null
  anyPending: boolean
  onDelete: () => void
  onDownload: () => void
  onUse: () => void
}) {
  const isSwitchTarget = activeModelId !== null && activeModelId !== model.id
  const downloadLabel = isSwitchTarget ? 'Download & use' : 'Download'

  return (
    <div className={settingsListRowClass}>
      <div className="grid gap-0.5">
        <div className={`flex items-center gap-2 ${appTypeGroupTextClass} ${appToneTextClass}`}>
          <span>{model.name}</span>
          <span
            className={`rounded-full border border-[color:var(--border)] px-2 py-0.5 ${appTypeTinyClass} ${appToneMutedClass}`}
          >
            {model.downloadSizeLabel}
          </span>
          {model.selected ? (
            <span
              className={`rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)] px-2 py-0.5 ${appTypeTinyClass} ${appToneTextClass}`}
            >
              Selected
            </span>
          ) : null}
        </div>
        <div className={`${appTypeSmallClass} ${appToneMutedClass}`}>{model.description}</div>
      </div>

      <div className="flex items-center gap-2">
        {model.installed ? (
          <InstalledModelActions
            anyPending={anyPending}
            model={model}
            pendingAction={pendingAction}
            onDelete={onDelete}
            onUse={onUse}
          />
        ) : (
          <ModelActionButton
            primary
            disabled={anyPending}
            label={pendingAction === 'download' ? 'Downloading…' : downloadLabel}
            icon={
              <PendingActionIcon
                active={pendingAction === 'download'}
                fallback={<Download size={11} />}
              />
            }
            onClick={onDownload}
          />
        )}
      </div>
    </div>
  )
}
