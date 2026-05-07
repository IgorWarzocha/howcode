import { type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import type { ComposerAttachment, ComposerFileSearchEntry } from '../../../desktop/types'
import { searchComposerAttachmentEntriesQuery } from '../../../query/desktop-query'

const fileMentionListboxId = 'composer-file-mention-listbox'
const fileMentionOptionPrefix = 'composer-file-mention'
const lastTokenPattern = /(?:^|\s)(@[^\s]*)$/

export function getComposerFileMentionOptionId(index: number) {
  return `${fileMentionOptionPrefix}-${index}`
}

function getFileMentionMatch(draft: string) {
  const match = draft.match(lastTokenPattern)
  const token = match?.[1]
  if (!token) return null
  return {
    filter: token.slice(1),
    start: draft.length - token.length,
  }
}

type UseComposerFileMentionsOptions = {
  draft: string
  projectId: string
  setDraft: (draft: string) => void
  attachAttachments: (attachments: ComposerAttachment[], options?: { closeMenu?: boolean }) => void
}

function toAttachment(entry: ComposerFileSearchEntry): ComposerAttachment {
  return {
    path: entry.path,
    name: entry.name,
    kind: entry.kind,
  }
}

export function useComposerFileMentions({
  draft,
  projectId,
  setDraft,
  attachAttachments,
}: UseComposerFileMentionsOptions) {
  const [files, setFiles] = useState<ComposerFileSearchEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null)
  const candidateMatch = getFileMentionMatch(draft)
  const filter = draft === dismissedDraft ? null : (candidateMatch?.filter ?? null)
  const open = filter !== null

  const visibleFiles = useMemo(() => files, [files])

  const selectFile = (file: ComposerFileSearchEntry) => {
    if (!candidateMatch) return
    attachAttachments([toAttachment(file)], { closeMenu: false })
    setDraft(
      `${draft.slice(0, candidateMatch.start)}@${file.relativePath} ${draft.slice(candidateMatch.start + candidateMatch.filter.length + 1)}`,
    )
    dismiss()
  }

  const dismiss = (options?: { clearDraft?: boolean }) => {
    setDismissedDraft(draft)
    setFiles([])
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
      setSelectedIndex((current) => Math.min(current + 1, Math.max(0, visibleFiles.length - 1)))
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((current) => Math.max(0, current - 1))
      return true
    }
    const selectedFile = visibleFiles[selectedIndex]
    if ((event.key === 'Tab' || event.key === 'Enter') && !event.shiftKey && selectedFile) {
      event.preventDefault()
      selectFile(selectedFile)
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
    setLoading(true)
    void searchComposerAttachmentEntriesQuery({ projectId, query: filter, limit: 60 })
      .then((nextFiles) => {
        if (!cancelled) setFiles(nextFiles)
      })
      .catch(() => {
        if (!cancelled) setFiles([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filter, open, projectId])

  useEffect(() => {
    if (selectedIndex >= visibleFiles.length) {
      setSelectedIndex(Math.max(0, visibleFiles.length - 1))
    }
  }, [selectedIndex, visibleFiles.length])

  useEffect(() => {
    if (dismissedDraft !== null && draft !== dismissedDraft) setDismissedDraft(null)
  }, [dismissedDraft, draft])

  return {
    activeDescendantId: open
      ? visibleFiles[selectedIndex]
        ? getComposerFileMentionOptionId(selectedIndex)
        : undefined
      : undefined,
    dismiss,
    files: visibleFiles,
    handleKeyDown,
    listboxId: fileMentionListboxId,
    loading,
    open,
    selectedIndex,
    selectFile,
    setSelectedIndex,
  }
}

export type ComposerFileMentions = ReturnType<typeof useComposerFileMentions>
