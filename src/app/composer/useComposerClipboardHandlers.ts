import {
  mergeComposerAttachments,
  normalizeComposerAttachments,
} from '@howcode/shared/composer-attachments'
import { type Dispatch, type SetStateAction, useCallback } from 'react'
import type { ComposerAttachment } from '../desktop/types'
import {
  getAttachmentKindsForPathsQuery,
  getPathForFileQuery,
  readClipboardFilePathsQuery,
  readClipboardImageQuery,
  readClipboardSnapshotQuery,
} from '../query/desktop-query'
import { buildLocalAttachmentKindLookup } from './composer-attachment-kind-lookup'
import { uploadTransferFilesAsAttachments } from './composer-browser-file-uploads'
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

async function tryApplyBrowserUploadedFiles(
  context: PasteContext,
  clipboardData: DataTransfer | null,
) {
  const uploadedAttachments = await uploadTransferFilesAsAttachments(clipboardData)
  return applyAttachmentPaste(context, uploadedAttachments)
}

function getBrowserUploadErrorMessage(error: unknown, action: 'dropped' | 'pasted') {
  const detail = error instanceof Error ? error.message : 'Upload failed.'
  return `Could not attach ${action} file. ${detail}`
}

async function tryApplyDirectDesktopAttachments(
  context: PasteContext,
  clipboardData: DataTransfer | null,
) {
  const directAttachments = getComposerAttachmentsFromClipboardData(clipboardData, {
    resolveFilePath: resolveDesktopFilePath,
  })
  const normalizedDirectAttachments = await normalizeDesktopAttachments(directAttachments)
  return {
    applied: applyAttachmentPaste(context, normalizedDirectAttachments),
    directAttachmentCount: directAttachments.length,
  }
}

async function tryApplyClipboardFilePathAttachments(context: PasteContext) {
  const fallbackClipboardFilePaths = await readFallbackClipboardFilePaths()
  const nativeAttachments = getComposerAttachmentsFromClipboardFilePaths(fallbackClipboardFilePaths)
  const normalizedNativeAttachments = await normalizeDesktopAttachments(nativeAttachments)
  return {
    applied: applyAttachmentPaste(context, normalizedNativeAttachments),
    fallbackClipboardFilePaths,
  }
}

async function tryApplyClipboardSnapshotAttachments(context: PasteContext) {
  const fallbackSnapshot = await readFallbackClipboardSnapshot()
  const fallbackAttachments = getComposerAttachmentsFromClipboardSnapshot(fallbackSnapshot)
  const normalizedFallbackAttachments = await normalizeDesktopAttachments(fallbackAttachments)
  return {
    applied: applyAttachmentPaste(context, normalizedFallbackAttachments),
    fallbackSnapshot,
  }
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

async function firstAppliedPasteAttempt(attempts: Array<() => boolean | Promise<boolean>>) {
  for (const attempt of attempts) {
    if (await attempt()) {
      return true
    }
  }

  return false
}

function tryApplyDirectTextPaste(
  context: PasteContext,
  textarea: HTMLTextAreaElement,
  input: { directPastedText: string | null; hasDirectAttachmentHint: boolean },
) {
  if (!(input.directPastedText && !input.hasDirectAttachmentHint)) {
    return false
  }

  applyTextPaste(context, textarea, input.directPastedText)
  return true
}

function applyResolvedPastedText(
  context: PasteContext,
  textarea: HTMLTextAreaElement,
  input: {
    directAttachmentCount: number
    directPastedText: string | null
    fallbackClipboardFilePaths: Awaited<ReturnType<typeof readFallbackClipboardFilePaths>>
    fallbackSnapshot: Awaited<ReturnType<typeof readFallbackClipboardSnapshot>>
    hasDirectAttachmentHint: boolean
  },
) {
  const pastedText = resolvePastedText(input)
  if (
    reportUnattachedFilePath(context, {
      directAttachmentCount: input.directAttachmentCount,
      hasDirectAttachmentHint: input.hasDirectAttachmentHint,
      pastedText,
    }) ||
    !pastedText
  ) {
    return true
  }

  applyTextPaste(context, textarea, pastedText)
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
      let directAttachmentCount = 0
      let browserUploadErrorMessage: string | null = null
      let fallbackClipboardFilePaths: Awaited<ReturnType<typeof readFallbackClipboardFilePaths>> =
        null
      let fallbackSnapshot: Awaited<ReturnType<typeof readFallbackClipboardSnapshot>> = null

      await firstAppliedPasteAttempt([
        async () => {
          const result = await tryApplyDirectDesktopAttachments(context, clipboardData)
          directAttachmentCount = result.directAttachmentCount
          return result.applied
        },
        async () => {
          try {
            return await tryApplyBrowserUploadedFiles(context, clipboardData)
          } catch (error) {
            browserUploadErrorMessage = getBrowserUploadErrorMessage(error, 'pasted')
            setErrorMessage(browserUploadErrorMessage)
            return false
          }
        },
        () =>
          tryApplyDirectTextPaste(context, textarea, { directPastedText, hasDirectAttachmentHint }),
        async () => {
          const result = await tryApplyClipboardFilePathAttachments(context)
          fallbackClipboardFilePaths = result.fallbackClipboardFilePaths
          return result.applied
        },
        async () => {
          const result = await tryApplyClipboardSnapshotAttachments(context)
          fallbackSnapshot = result.fallbackSnapshot
          return result.applied
        },
        () => tryApplyClipboardImage(context, hasDirectFilePayload),
        () =>
          applyResolvedPastedText(context, textarea, {
            directAttachmentCount,
            directPastedText,
            fallbackClipboardFilePaths,
            fallbackSnapshot,
            hasDirectAttachmentHint,
          }),
      ])

      if (browserUploadErrorMessage) {
        setErrorMessage(browserUploadErrorMessage)
      }
    },
    [setAttachments, setDraftValue, setErrorMessage],
  )

  const handleDrop = useCallback(
    async (dataTransfer: DataTransfer | null) => {
      let browserUploadErrorMessage: string | null = null
      const uploadedAttachments = await uploadTransferFilesAsAttachments(dataTransfer).catch(
        (error) => {
          browserUploadErrorMessage = getBrowserUploadErrorMessage(error, 'dropped')
          return []
        },
      )
      if (uploadedAttachments.length > 0) {
        setAttachments((current) => mergeComposerAttachments(current, uploadedAttachments))
        setErrorMessage(null)
        return true
      }

      const droppedAttachments = await normalizeDesktopAttachments(
        getComposerAttachmentsFromClipboardData(dataTransfer, {
          resolveFilePath: resolveDesktopFilePath,
        }),
      )
      if (droppedAttachments.length === 0) {
        if (browserUploadErrorMessage) {
          setErrorMessage(browserUploadErrorMessage)
          return true
        }
        return false
      }

      setAttachments((current) => mergeComposerAttachments(current, droppedAttachments))
      setErrorMessage(browserUploadErrorMessage)
      return true
    },
    [setAttachments, setErrorMessage],
  )

  return { handleDrop, handlePaste }
}
