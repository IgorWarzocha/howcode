import { ArrowUpRight, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { CompactMetaRow } from '../../../components/common/compact-meta-row'
import { ConfirmPopover } from '../../../components/common/confirm-popover'
import { Tooltip } from '../../../components/common/tooltip'
import type { PiConfiguredSkill } from '../../../desktop/types'
import { openPathQuery } from '../../../query/desktop-query'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  inlineEmptyNoteClass,
  viewCloseButtonClass,
} from '../../../ui/classes'
import { skillsListClass, skillsPreviewListClass } from '../../../ui/screen-classes'
import { cn } from '../../../utils/cn'

type InstalledSkillsSectionProps = {
  installScope: 'global' | 'project' | 'chat'
  expanded: boolean
  skills: PiConfiguredSkill[]
  isPendingRemove: (installedPath: string) => boolean
  onRemove: (configuredSkill: PiConfiguredSkill) => Promise<void>
}

export function InstalledSkillsSection({
  installScope,
  expanded,
  skills,
  isPendingRemove,
  onRemove,
}: InstalledSkillsSectionProps) {
  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null)
  const confirmRemoveButtonRef = useRef<HTMLButtonElement>(null)

  if (skills.length === 0) {
    return <div className={inlineEmptyNoteClass}>No {installScope} skills.</div>
  }

  return (
    <div className={expanded ? skillsListClass : skillsPreviewListClass}>
      {skills.map((configuredSkill) => (
        <CompactMetaRow
          key={`${configuredSkill.scope}:${configuredSkill.installedPath}`}
          density="dense"
          contentClassName={`grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-1.5 overflow-hidden ${appTypeGroupTextClass}`}
          actions={
            <div className="relative">
              <Tooltip
                content={isPendingRemove(configuredSkill.installedPath) ? 'Removing' : 'Remove'}
              >
                <button
                  type="button"
                  ref={
                    confirmRemovePath === configuredSkill.installedPath
                      ? confirmRemoveButtonRef
                      : undefined
                  }
                  className={cn(viewCloseButtonClass, 'hover:text-[color:var(--danger)]')}
                  onClick={() => {
                    if (isPendingRemove(configuredSkill.installedPath)) {
                      return
                    }

                    setConfirmRemovePath((current) =>
                      current === configuredSkill.installedPath
                        ? null
                        : configuredSkill.installedPath,
                    )
                  }}
                  disabled={isPendingRemove(configuredSkill.installedPath)}
                  aria-label={
                    isPendingRemove(configuredSkill.installedPath) ? 'Removing' : 'Remove'
                  }
                >
                  <Trash2 size={13} />
                </button>
              </Tooltip>

              <ConfirmPopover
                open={confirmRemovePath === configuredSkill.installedPath}
                anchorRef={confirmRemoveButtonRef}
                onClose={() => setConfirmRemovePath(null)}
                onConfirm={() => void onRemove(configuredSkill)}
              />
            </div>
          }
        >
          <Tooltip content="Open SKILL.md in default editor">
            <button
              type="button"
              className="group inline-flex shrink-0 items-center gap-0.5 p-0"
              onClick={() => void openPathQuery(configuredSkill.skillFilePath)}
              aria-label={`Open ${configuredSkill.displayName} SKILL.md in default editor`}
            >
              <span
                className={cn(
                  `${appTypeGroupTextClass} ${appToneTextClass}`,
                  'transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]',
                )}
              >
                {configuredSkill.displayName}
              </span>
              <ArrowUpRight
                size={12}
                className="shrink-0 text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
              />
            </button>
          </Tooltip>
          <div className={cn(`${appTypeGroupTextClass} ${appToneMutedClass}`, 'min-w-0 truncate')}>
            {configuredSkill.description || configuredSkill.sourceRepo || configuredSkill.source}
          </div>
        </CompactMetaRow>
      ))}
    </div>
  )
}
