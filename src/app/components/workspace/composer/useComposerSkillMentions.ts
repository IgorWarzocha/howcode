import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import type { ComposerSkillReference } from '../../../desktop/types'
import { getComposerSkillsQuery } from '../../../query/desktop-query'

const skillMentionListboxId = 'composer-skill-mention-listbox'
const skillMentionOptionPrefix = 'composer-skill-mention'
const whitespaceCharacterPattern = /\s/
const lastTokenPattern = /(?:^|\s)(\$\S*)$/

export function getComposerSkillMentionOptionId(index: number) {
  return `${skillMentionOptionPrefix}-${index}`
}

function getSkillMentionMatch(draft: string) {
  const match = draft.match(lastTokenPattern)
  const token = match?.[1]
  if (!token) return null
  const query = token.slice(1)
  if (whitespaceCharacterPattern.test(query)) return null
  return {
    filter: query.toLowerCase(),
    start: draft.length - token.length,
  }
}

type UseComposerSkillMentionsOptions = {
  draft: string
  projectId: string
  sessionPath: string | null
  composerMode?: 'chat' | 'code'
  setDraft: (draft: string) => void
}

export function useComposerSkillMentions({
  draft,
  projectId,
  sessionPath,
  composerMode = 'code',
  setDraft,
}: UseComposerSkillMentionsOptions) {
  const [skills, setSkills] = useState<ComposerSkillReference[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null)
  const candidateMatch = getSkillMentionMatch(draft)
  const filter = draft === dismissedDraft ? null : (candidateMatch?.filter ?? null)
  const open = filter !== null

  const filteredSkills = useMemo(() => {
    if (filter === null) return []
    return skills
      .filter((skill) => skill.name.toLowerCase().includes(filter))
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [filter, skills])

  const selectSkill = (skill: ComposerSkillReference) => {
    if (!candidateMatch) return
    setDraft(`${draft.slice(0, candidateMatch.start)}$${skill.name} `)
  }

  const dismiss = (options?: { clearDraft?: boolean }) => {
    setDismissedDraft(draft)
    setSkills([])
    setLoading(false)
    setSelectedIndex(0)
    if (options?.clearDraft) setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return false
    if (event.key === 'Escape') {
      event.preventDefault()
      dismiss()
      return true
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((current) => Math.min(current + 1, Math.max(0, filteredSkills.length - 1)))
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((current) => Math.max(0, current - 1))
      return true
    }
    const selectedSkill = filteredSkills[selectedIndex]
    if ((event.key === 'Tab' || event.key === 'Enter') && !event.shiftKey && selectedSkill) {
      event.preventDefault()
      selectSkill(selectedSkill)
      return true
    }
    return false
  }

  useEffect(() => {
    if (!open) {
      setSelectedIndex(0)
      setLoading(false)
      return
    }

    let cancelled = false
    setSkills([])
    setSelectedIndex(0)
    setLoading(true)
    void getComposerSkillsQuery({ projectId, sessionPath, composerMode })
      .then((nextSkills) => {
        if (!cancelled) setSkills(nextSkills)
      })
      .catch(() => {
        if (!cancelled) setSkills([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [composerMode, open, projectId, sessionPath])

  useEffect(() => {
    if (selectedIndex >= filteredSkills.length) {
      setSelectedIndex(Math.max(0, filteredSkills.length - 1))
    }
  }, [filteredSkills.length, selectedIndex])

  useEffect(() => {
    if (dismissedDraft !== null && draft !== dismissedDraft) setDismissedDraft(null)
  }, [dismissedDraft, draft])

  return {
    activeDescendantId: open
      ? filteredSkills[selectedIndex]
        ? getComposerSkillMentionOptionId(selectedIndex)
        : undefined
      : undefined,
    dismiss,
    handleKeyDown,
    listboxId: skillMentionListboxId,
    loading,
    open,
    selectedIndex,
    selectSkill,
    setSelectedIndex,
    skills: filteredSkills,
  }
}

export type ComposerSkillMentions = ReturnType<typeof useComposerSkillMentions>
