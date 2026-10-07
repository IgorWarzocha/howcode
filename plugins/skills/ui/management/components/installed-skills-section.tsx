import { Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { CompactMetaRow } from '../../../../../src/app/common/compact-meta-row'
import { ConfirmPopover } from '../../../../../src/app/common/confirm-popover'
import { Tooltip } from '../../../../../src/app/common/tooltip'
import type { PiConfiguredSkill } from '../../../../../src/app/desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  inlineEmptyNoteClass,
  viewCloseButtonClass,
} from '../../../../../src/app/ui/classes'
import { skillsListClass, skillsPreviewListClass } from '../../../../../src/app/ui/screen-classes'
import { cn } from '../../../../../src/app/utils/cn'

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
          <span
            className={cn(appTypeGroupTextClass, appToneTextClass)}
            title={configuredSkill.skillFilePath}
          >
            {configuredSkill.displayName}
          </span>
          <div className={cn(`${appTypeGroupTextClass} ${appToneMutedClass}`, 'min-w-0 truncate')}>
            {configuredSkill.description || configuredSkill.sourceRepo || configuredSkill.source}
          </div>
        </CompactMetaRow>
      ))}
    </div>
  )
}
