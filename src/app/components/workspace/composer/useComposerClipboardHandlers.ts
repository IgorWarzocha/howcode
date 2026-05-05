import { type Dispatch, type SetStateAction, useCallback } from 'react'
import {
  mergeComposerAttachments,
  normalizeComposerAttachments,
} from '../../../../../shared/composer-attachments'
import type { ComposerAttachment } from '../../../desktop/types'
import {
  getAttachmentKindsForPathsQuery,
  getPathForFileQuery,
  readClipboardFilePathsQuery,
  readClipboardImageQuery,
  readClipboardSnapshotQuery,
} from '../../../query/desktop-query'
import { buildLocalAttachmentKindLookup } from './composer-attachment-kind-lookup'
import {
  attachmentClipboardSnapshotFormats,
  getComposerAttachmentsFromClipboardData,
  getComposerAttachmentsFromClipboardFilePaths,
  getComposerAttachmentsFromClipboardSnapshot,
  getPreferredClipboardTextFromClipboardData,
  getPreferredClipboardTextFromClipboardFilePaths,
  getPreferredClipboardTextFromClipboardSnapshot,
  hasAttachmentHintInClipboardData,
  hasFilePayloadInClipboardData,
} from './composer-paste-attachments'

function applyPastedTextToTextarea(textarea: HTMLTextAreaElement, pastedText: string) {
  const selectionStart = textarea.selectionStart ?? textarea.value.length
  const selectionEnd = textarea.selectionEnd ?? textarea.value.length
  textarea.setRangeText(pastedText, selectionStart, selectionEnd, 'end')
  return textarea.value
}

function resolveDesktopFilePath(file: {
  path?: string | null
  name?: string | null
  type?: string | null
}) {
  return getPathForFileQuery(file as File) ?? null
}

async function resolveDesktopAttachmentKinds(paths: string[]) {
  try {
    return await getAttachmentKindsForPathsQuery(paths)
  } catch {
    return null
  }
}

async function normalizeDesktopAttachments(attachments: ComposerAttachment[]) {
  const { fallbackKindsByPath, localPaths } = buildLocalAttachmentKindLookup(attachments)
  const kindsByPath = await resolveDesktopAttachmentKinds(localPaths)
  const hasLookup = kindsByPath !== null

  return normalizeComposerAttachments(attachments, {
    resolveAttachmentKind: (path) => {
      if (hasLookup && kindsByPath && Object.hasOwn(kindsByPath, path)) {
        return kindsByPath[path] ?? null
      }

      return fallbackKindsByPath[path] ?? null
    },
  })
}

type PasteContext = {
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: (value: SetStateAction<string>) => void
  setErrorMessage: Dispatch<SetStateAction<string | null>>
}

function applyAttachmentPaste(context: PasteContext, attachments: ComposerAttachment[]) {
  if (attachments.length === 0) return false
  context.setAttachments((current) => mergeComposerAttachments(current, attachments))
  context.setErrorMessage(null)
  return true
}

function applyTextPaste(context: PasteContext, textarea: HTMLTextAreaElement, pastedText: string) {
  const nextValue = applyPastedTextToTextarea(textarea, pastedText)
  context.setDraftValue(nextValue)
  context.setErrorMessage(null)
  const nextCursorPosition = textarea.selectionStart ?? nextValue.length
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(nextCursorPosition, nextCursorPosition)
  })
}

async function readFallbackClipboardFilePaths() {
  try {
    return await readClipboardFilePathsQuery()
  } catch {
    return null
  }
}

async function readFallbackClipboardSnapshot() {
  try {
    return await readClipboardSnapshotQuery(attachmentClipboardSnapshotFormats)
  } catch {
    return null
  }
}

async function tryApplyClipboardImage(context: PasteContext, hasDirectFilePayload: boolean) {
  if (!hasDirectFilePayload) return false
  const clipboardImageAttachment = await readClipboardImageQuery().catch(() => null)
  if (!clipboardImageAttachment) return false
  return applyAttachmentPaste(context, [clipboardImageAttachment])
}

function resolvePastedText(input: {
  directPastedText: string | null
  fallbackClipboardFilePaths: Awaited<ReturnType<typeof readFallbackClipboardFilePaths>>
  fallbackSnapshot: Awaited<ReturnType<typeof readFallbackClipboardSnapshot>>
}) {
  return (
    input.directPastedText ||
    getPreferredClipboardTextFromClipboardFilePaths(input.fallbackClipboardFilePaths) ||
    getPreferredClipboardTextFromClipboardSnapshot(input.fallbackSnapshot)
  )
}

function reportUnattachedFilePath(
  context: PasteContext,
  input: {
    directAttachmentCount: number
    hasDirectAttachmentHint: boolean
    pastedText: string | null
  },
) {
  if (!input.hasDirectAttachmentHint) return false
  if (input.pastedText && input.directAttachmentCount === 0) return false
  context.setErrorMessage(
    'Could not attach the pasted file path. Check that the file still exists.',
  )
  return true
}

type UseComposerClipboardHandlersInput = {
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>
  setDraftValue: (value: SetStateAction<string>) => void
  setErrorMessage: Dispatch<SetStateAction<string | null>>
}

export function useComposerClipboardHandlers({
  setAttachments,
  setDraftValue,
  setErrorMessage,
}: UseComposerClipboardHandlersInput) {
  const handlePaste = useCallback(
    async (request: { clipboardData: DataTransfer | null; textarea: HTMLTextAreaElement }) => {
      const context = { setAttachments, setDraftValue, setErrorMessage }
      const { clipboardData, textarea } = request
      const directPastedText = getPreferredClipboardTextFromClipboardData(clipboardData)
      const hasDirectAttachmentHint = hasAttachmentHintInClipboardData(clipboardData)
      const hasDirectFilePayload = hasFilePayloadInClipboardData(clipboardData)
      const directAttachments = getComposerAttachmentsFromClipboardData(clipboardData, {
        resolveFilePath: resolveDesktopFilePath,
      })
      const normalizedDirectAttachments = await normalizeDesktopAttachments(directAttachments)
      if (applyAttachmentPaste(context, normalizedDirectAttachments)) return
      if (directPastedText && !hasDirectAttachmentHint) {
        applyTextPaste(context, textarea, directPastedText)
        return
      }

      const fallbackClipboardFilePaths = await readFallbackClipboardFilePaths()
      const nativeAttachments = getComposerAttachmentsFromClipboardFilePaths(
        fallbackClipboardFilePaths,
      )
      const normalizedNativeAttachments = await normalizeDesktopAttachments(nativeAttachments)
      if (applyAttachmentPaste(context, normalizedNativeAttachments)) return

      const fallbackSnapshot = await readFallbackClipboardSnapshot()
      const fallbackAttachments = getComposerAttachmentsFromClipboardSnapshot(fallbackSnapshot)
      const normalizedFallbackAttachments = await normalizeDesktopAttachments(fallbackAttachments)
      if (applyAttachmentPaste(context, normalizedFallbackAttachments)) return
      if (await tryApplyClipboardImage(context, hasDirectFilePayload)) return

      const pastedText = resolvePastedText({
        directPastedText,
        fallbackClipboardFilePaths,
        fallbackSnapshot,
      })
      if (
        reportUnattachedFilePath(context, {
          directAttachmentCount: directAttachments.length,
          hasDirectAttachmentHint,
          pastedText,
        }) ||
        !pastedText
      ) {
        return
      }
      applyTextPaste(context, textarea, pastedText)
    },
    [setAttachments, setDraftValue, setErrorMessage],
  )

  const handleDrop = useCallback(
    async (dataTransfer: DataTransfer | null) => {
      const droppedAttachments = await normalizeDesktopAttachments(
        getComposerAttachmentsFromClipboardData(dataTransfer, {
          resolveFilePath: resolveDesktopFilePath,
        }),
      )
      if (droppedAttachments.length === 0) {
        return false
      }

      setAttachments((current) => mergeComposerAttachments(current, droppedAttachments))
      setErrorMessage(null)
      return true
    },
    [setAttachments, setErrorMessage],
  )

  return { handleDrop, handlePaste }
}
