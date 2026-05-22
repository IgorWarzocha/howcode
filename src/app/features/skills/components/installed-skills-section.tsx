import { FilePenLine, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { CompactMetaRow } from '../../../components/common/compact-meta-row'
import { ConfirmPopover } from '../../../components/common/confirm-popover'
import { TextButton } from '../../../components/common/text-button'
import { Tooltip } from '../../../components/common/tooltip'
import type { PiConfiguredSkill } from '../../../desktop/types'
import { openPathQuery } from '../../../query/desktop-query'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  compactRoundIconButtonClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'

type InstalledSkillsSectionProps = {
  installScope: 'global' | 'project' | 'chat'
  skills: PiConfiguredSkill[]
  isPendingRemove: (installedPath: string) => boolean
  onRemove: (configuredSkill: PiConfiguredSkill) => Promise<void>
}

export function InstalledSkillsSection({
  installScope,
  skills,
  isPendingRemove,
  onRemove,
}: InstalledSkillsSectionProps) {
  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null)
  const confirmRemoveButtonRef = useRef<HTMLButtonElement>(null)

  if (skills.length === 0) {
    return (
      <div className={`px-2 py-1.5 ${appTypeGroupTextClass} ${appToneMutedClass}`}>
        No {installScope} skills.
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {skills.map((configuredSkill) => (
        <CompactMetaRow
          key={`${configuredSkill.scope}:${configuredSkill.installedPath}`}
          actions={
            <>
              <Tooltip content="Open SKILL.md in default editor">
                <TextButton
                  className={compactRoundIconButtonClass}
                  onClick={() => void openPathQuery(configuredSkill.skillFilePath)}
                  aria-label="Open SKILL.md in default editor"
                >
                  <FilePenLine size={13} />
                </TextButton>
              </Tooltip>
              <div className="relative">
                <Tooltip
                  content={isPendingRemove(configuredSkill.installedPath) ? 'Removing' : 'Remove'}
                >
                  <TextButton
                    ref={
                      confirmRemovePath === configuredSkill.installedPath
                        ? confirmRemoveButtonRef
                        : undefined
                    }
                    className={cn(compactRoundIconButtonClass, 'hover:text-[color:var(--danger)]')}
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
                  </TextButton>
                </Tooltip>

                <ConfirmPopover
                  open={confirmRemovePath === configuredSkill.installedPath}
                  anchorRef={confirmRemoveButtonRef}
                  onClose={() => setConfirmRemovePath(null)}
                  onConfirm={() => void onRemove(configuredSkill)}
                />
              </div>
            </>
          }
        >
          <div
            className={`min-w-0 flex items-baseline gap-1.5 overflow-hidden ${appTypeGroupTextClass}`}
          >
            <div className={cn(`${appTypeGroupTextClass} ${appToneTextClass}`, 'shrink-0')}>
              {configuredSkill.displayName}
            </div>
            <div
              className={cn(`${appTypeGroupTextClass} ${appToneMutedClass}`, 'min-w-0 truncate')}
            >
              {configuredSkill.description || configuredSkill.sourceRepo || configuredSkill.source}
            </div>
          </div>
        </CompactMetaRow>
      ))}
    </div>
  )
}
