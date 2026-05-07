import type { RefObject } from 'react'
import { cn } from '../../../utils/cn'
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
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left',
        selected
          ? 'bg-[color:var(--accent-bg)] text-[color:var(--text)]'
          : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
      )}
      onPointerEnter={() => skillMentions.setSelectedIndex(index)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => skillMentions.selectSkill(skill)}
    >
      <span className="shrink-0 text-[12px] text-[color:var(--text)]">${skill.name}</span>
      {skill.description ? (
        <span className="min-w-0 truncate text-[12px] text-[color:var(--muted)]">
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
    <div
      ref={panelRef}
      id={skillMentions.listboxId}
      role="listbox"
      tabIndex={-1}
      aria-label="Composer skills"
      className={cn(
        'pointer-events-auto w-[26.5rem] max-w-[calc(100vw-2rem)] scroll-py-1.5 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--panel)] p-1.5 shadow-[var(--shadow)]',
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
        <div className="px-2 py-2 text-[12px] text-[color:var(--muted)]">
          {skillMentions.loading ? 'Loading skills…' : 'No matching skills'}
        </div>
      )}
    </div>
  )
}
