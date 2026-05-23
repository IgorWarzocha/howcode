import {
  appToneMutedClass,
  appToneTextClass,
  appTypeControlClass,
  appTypeSmallClass,
  composerPopoverOptionSelectedClass,
  composerPopoverPanelClass,
  inlineEmptyNoteClass,
} from '@howcode/ui'
import type { RefObject } from 'react'
import { PopoverPanel } from '../common/popover'
import { cn } from '../utils/cn'
import {
  type ComposerSkillMentions,
  getComposerSkillMentionOptionId,
} from './useComposerSkillMentions'

function SkillMentionOption({
  index,
  selected,
  skillMentions,
  skill,
}: {
  index: number
  selected: boolean
  skillMentions: ComposerSkillMentions
  skill: ComposerSkillMentions['skills'][number]
}) {
  return (
    <button
      id={getComposerSkillMentionOptionId(index)}
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        'flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-[color:var(--surface-hover)] focus-visible:bg-[color:var(--surface-hover)] focus-visible:outline-none',
        appTypeControlClass,
        appToneMutedClass,
        selected
          ? composerPopoverOptionSelectedClass
          : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
      )}
      onPointerEnter={() => skillMentions.setSelectedIndex(index)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => skillMentions.selectSkill(skill)}
    >
      <span
        className={cn(
          'max-w-56 flex-none truncate whitespace-nowrap',
          appTypeSmallClass,
          appToneTextClass,
        )}
      >
        ${skill.name}
      </span>
      {skill.description ? (
        <span className={cn('min-w-0 truncate', appTypeSmallClass, appToneMutedClass)}>
          {skill.description}
        </span>
      ) : null}
    </button>
  )
}

export function ComposerSkillMentionPanel({
  panelRef,
  skillMentions,
}: {
  panelRef: RefObject<HTMLDivElement | null>
  skillMentions: ComposerSkillMentions
}) {
  if (!skillMentions.open) return null
  return (
    <PopoverPanel
      surface={false}
      ref={panelRef}
      id={skillMentions.listboxId}
      role="listbox"
      tabIndex={-1}
      aria-label="Composer skills"
      className={cn(
        composerPopoverPanelClass,
        'w-[26.5rem] max-w-[calc(100vw-2rem)]',
        skillMentions.skills.length > 10 && 'max-h-72 overflow-y-auto',
      )}
    >
      {skillMentions.skills.length > 0 ? (
        skillMentions.skills.map((skill, index) => (
          <SkillMentionOption
            key={skill.filePath}
            index={index}
            selected={index === skillMentions.selectedIndex}
            skill={skill}
            skillMentions={skillMentions}
          />
        ))
      ) : (
        <div className={inlineEmptyNoteClass}>
          {skillMentions.loading ? 'Loading skills…' : 'No matching skills'}
        </div>
      )}
    </PopoverPanel>
  )
}
