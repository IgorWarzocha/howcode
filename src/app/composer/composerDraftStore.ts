import {
  createStoragePersistence,
  getBeforeUnloadTarget,
  getBrowserStorage,
  hydratePersistedRecordMap,
  type PersistedRecordStoreOptions,
} from '@howaboua/howcode-sdk/persistence/record-store'
import { getLocalDraftDirectoryId } from '@howcode/shared/conversation-ids'
import type { ComposerAttachment } from '../desktop/types'

type ComposerDraft = {
  prompt: string
  attachments: ComposerAttachment[]
  pickerOpen: boolean
}

type PersistedComposerDraft = {
  prompt: string
  attachments?: ComposerAttachment[]
  pickerOpen?: boolean
}

type PersistedComposerDraftState = {
  version: 1
  draftsByThreadId: Record<string, PersistedComposerDraft>
}

type ComposerDraftStoreOptions = PersistedRecordStoreOptions

const DEFAULT_STORAGE_KEY = 'howcode:composer-drafts:v1'
const DEFAULT_DEBOUNCE_MS = 320

function cloneAttachments(attachments: ComposerAttachment[]) {
  return attachments.map((attachment) => ({ ...attachment }))
}

function cloneDraft(draft: ComposerDraft): ComposerDraft {
  return {
    prompt: draft.prompt,
    attachments: cloneAttachments(draft.attachments),
    pickerOpen: draft.pickerOpen,
  }
}

function isComposerAttachment(value: unknown): value is ComposerAttachment {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ComposerAttachment>

  return (
    typeof candidate.path === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.kind === 'directory' || candidate.kind === 'text' || candidate.kind === 'image')
  )
}

function toDraft(value: unknown): ComposerDraft | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PersistedComposerDraft>

  const prompt = typeof candidate.prompt === 'string' ? candidate.prompt : ''
  const attachments = Array.isArray(candidate.attachments)
    ? candidate.attachments.flatMap((attachment) =>
        isComposerAttachment(attachment) ? [{ ...attachment }] : [],
      )
    : []
  const pickerOpen = candidate.pickerOpen === true

  if (prompt.length === 0 && attachments.length === 0 && !pickerOpen) {
    return null
  }

  return { prompt, attachments, pickerOpen }
}

function serializeDrafts(
  draftsByChatId: Record<string, ComposerDraft>,
): PersistedComposerDraftState {
  return {
    version: 1,
    draftsByThreadId: Object.fromEntries(
      Object.entries(draftsByChatId).map(([chatId, draft]) => [
        chatId,
        {
          prompt: draft.prompt,
          ...(draft.pickerOpen ? { pickerOpen: true } : {}),
          ...(draft.attachments.length > 0
            ? { attachments: cloneAttachments(draft.attachments) }
            : {}),
        },
      ]),
    ),
  }
}

export function getComposerDraftChatId({
  composerProfile = 'coding',
  directoryId,
  conversationId,
}: {
  composerProfile?: 'general' | 'coding'
  directoryId: string
  conversationId: string | null
}) {
  if (typeof conversationId === 'string' && conversationId.length > 0) {
    return `session:${conversationId}`
  }

  return directoryId.length > 0
    ? `project:${directoryId}:${composerProfile === 'general' ? 'chat' : 'code'}:new-thread`
    : null
}

export function createComposerDraftStore({
  storage = getBrowserStorage(),
  storageKey = DEFAULT_STORAGE_KEY,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  beforeUnloadTarget = getBeforeUnloadTarget(),
}: ComposerDraftStoreOptions = {}) {
  let draftsByChatId = hydratePersistedRecordMap({
    storage,
    storageKey,
    version: 1,
    recordKey: 'draftsByThreadId',
    toEntry: toDraft,
  })
  let draftCount = Object.keys(draftsByChatId).length

  const persistence = createStoragePersistence({
    storage,
    storageKey,
    debounceMs,
    beforeUnloadTarget,
    hasEntries: () => draftCount > 0,
    serialize: () => serializeDrafts(draftsByChatId),
  })

  const getMirroredDirectoryDraftChatId = (chatId: string) => {
    if (!chatId.startsWith('session:')) {
      return null
    }

    const directoryId = getLocalDraftDirectoryId(chatId.slice('session:'.length))
    return directoryId ? `project:${directoryId}:new-thread` : null
  }

  const areDraftsEqual = (left: ComposerDraft | undefined, right: ComposerDraft | undefined) => {
    if (!(left && right)) {
      return false
    }

    if (
      left.prompt !== right.prompt ||
      left.pickerOpen !== right.pickerOpen ||
      left.attachments.length !== right.attachments.length
    ) {
      return false
    }

    return left.attachments.every((leftAttachment, index) => {
      const rightAttachment = right.attachments[index]
      return (
        rightAttachment !== undefined &&
        leftAttachment.path === rightAttachment.path &&
        leftAttachment.name === rightAttachment.name &&
        leftAttachment.kind === rightAttachment.kind
      )
    })
  }

  const isEmptyDraft = (draft: ComposerDraft) =>
    draft.prompt.length === 0 && draft.attachments.length === 0 && !draft.pickerOpen

  const deleteDraft = (chatId: string) => {
    if (!(chatId in draftsByChatId)) return false
    delete draftsByChatId[chatId]
    draftCount -= 1
    return true
  }

  const clearDraftWithMirror = (
    chatId: string,
    mirroredChatId: string | null,
    previousDraft: ComposerDraft | undefined,
  ) => {
    deleteDraft(chatId)
    if (mirroredChatId && areDraftsEqual(draftsByChatId[mirroredChatId], previousDraft)) {
      deleteDraft(mirroredChatId)
    }
  }

  const upsertDraftWithMirror = (
    chatId: string,
    mirroredChatId: string | null,
    nextDraft: ComposerDraft,
  ) => {
    const addsChatDraft = !(chatId in draftsByChatId)
    const addsMirroredDraft = Boolean(mirroredChatId && !(mirroredChatId in draftsByChatId))
    draftsByChatId = {
      ...draftsByChatId,
      [chatId]: cloneDraft(nextDraft),
      ...(mirroredChatId ? { [mirroredChatId]: cloneDraft(nextDraft) } : {}),
    }
    draftCount += (addsChatDraft ? 1 : 0) + (addsMirroredDraft ? 1 : 0)
  }

  const writeDraft = (chatId: string, nextDraft: ComposerDraft) => {
    const mirroredChatId = getMirroredDirectoryDraftChatId(chatId)
    const previousDraft = draftsByChatId[chatId]
    if (isEmptyDraft(nextDraft)) clearDraftWithMirror(chatId, mirroredChatId, previousDraft)
    else upsertDraftWithMirror(chatId, mirroredChatId, nextDraft)
    persistence.schedulePersist()
  }

  const updateDraft = (chatId: string, updater: (currentDraft: ComposerDraft) => ComposerDraft) => {
    const currentDraft = draftsByChatId[chatId] ?? {
      prompt: '',
      attachments: [],
      pickerOpen: false,
    }
    writeDraft(chatId, updater(currentDraft))
  }

  return {
    storageKey,
    getDraft(chatId: string) {
      const draft = draftsByChatId[chatId]
      return draft ? cloneDraft(draft) : null
    },
    setDraft(chatId: string, draft: ComposerDraft) {
      writeDraft(chatId, draft)
    },
    setPrompt(chatId: string, prompt: string) {
      updateDraft(chatId, (currentDraft) => ({
        ...currentDraft,
        prompt,
      }))
    },
    setAttachments(chatId: string, attachments: ComposerAttachment[]) {
      updateDraft(chatId, (currentDraft) => ({
        ...currentDraft,
        attachments: cloneAttachments(attachments),
      }))
    },
    clearComposerContent(chatId: string) {
      writeDraft(chatId, { prompt: '', attachments: [], pickerOpen: false })
    },
    clearChatDraft(chatId: string) {
      if (!(chatId in draftsByChatId)) {
        return
      }

      const mirroredChatId = getMirroredDirectoryDraftChatId(chatId)
      const previousDraft = draftsByChatId[chatId]

      delete draftsByChatId[chatId]
      draftCount -= 1

      if (mirroredChatId && areDraftsEqual(draftsByChatId[mirroredChatId], previousDraft)) {
        delete draftsByChatId[mirroredChatId]
        draftCount -= 1
      }
      persistence.schedulePersist()
    },
    flush: persistence.flush,
    destroy() {
      persistence.destroy()
    },
  }
}

export const composerDraftStore = createComposerDraftStore()

export type { ComposerDraft }
