import type { ProjectDiffBaseline } from '../../../desktop/types'
import {
  createStoragePersistence,
  getBeforeUnloadTarget,
  getBrowserStorage,
  hydratePersistedRecordMap,
  type PersistedRecordStoreOptions,
} from '../../../workspace-shell/persistence/persistedRecordStore'
import {
  createLineRangeTarget,
  type DiffSide,
  type ReviewDraft,
  type ReviewPurpose,
  type ReviewTarget,
  type SavedReviewComment,
} from './review-model'

export type ReviewContext = {
  comments: SavedReviewComment[]
  draft: ReviewDraft | null
}

type PersistedLineTarget = {
  fileKey?: unknown
  filePath?: unknown
  side?: unknown
  lineNumber?: unknown
  endSide?: unknown
  endLineNumber?: unknown
}

type PersistedReviewDraft = PersistedLineTarget & {
  target?: unknown
  body?: unknown
  purpose?: unknown
}

type PersistedReviewContext = {
  comments?: unknown
  draft?: unknown
}

type PersistedReviewState = {
  version: 1
  contextsById: Record<string, PersistedReviewContext>
}

type UnknownReviewPoint = {
  side?: unknown
  lineNumber?: unknown
}

type UnknownReviewTarget = {
  kind?: unknown
  fileKey?: unknown
  filePath?: unknown
  start?: unknown
  end?: unknown
}

type ReviewStoreOptions = PersistedRecordStoreOptions
type ReviewStoreListener = () => void

const DEFAULT_STORAGE_KEY = 'howcode:diff-comments:v1'
const DEFAULT_DEBOUNCE_MS = 320

function isDiffSide(value: unknown): value is DiffSide {
  return value === 'deletions' || value === 'additions'
}

function isLineNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function decodeReviewPurpose(value: unknown): ReviewPurpose | null {
  if (value === undefined || value === 'comment') return 'comment'
  return value === 'rejection' ? 'rejection' : null
}

function decodeReviewTarget(value: unknown): ReviewTarget | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as UnknownReviewTarget
  if (candidate.kind === 'file') {
    return typeof candidate.fileKey === 'string' && typeof candidate.filePath === 'string'
      ? { kind: 'file', fileKey: candidate.fileKey, filePath: candidate.filePath }
      : null
  }
  if (candidate.kind !== 'line-range') return null

  const start = candidate.start
  const end = candidate.end
  if (!start || typeof start !== 'object' || !end || typeof end !== 'object') return null
  const startPoint = start as UnknownReviewPoint
  const endPoint = end as UnknownReviewPoint
  if (
    typeof candidate.fileKey !== 'string' ||
    typeof candidate.filePath !== 'string' ||
    !isDiffSide(startPoint.side) ||
    !isLineNumber(startPoint.lineNumber) ||
    !isDiffSide(endPoint.side) ||
    !isLineNumber(endPoint.lineNumber)
  ) {
    return null
  }

  return createLineRangeTarget({
    fileKey: candidate.fileKey,
    filePath: candidate.filePath,
    side: startPoint.side,
    lineNumber: startPoint.lineNumber,
    endSide: endPoint.side,
    endLineNumber: endPoint.lineNumber,
  })
}

function decodeLegacyLineTarget(candidate: PersistedLineTarget): ReviewTarget | null {
  if (
    typeof candidate.fileKey !== 'string' ||
    typeof candidate.filePath !== 'string' ||
    !isDiffSide(candidate.side) ||
    !isLineNumber(candidate.lineNumber) ||
    (candidate.endSide !== undefined && !isDiffSide(candidate.endSide)) ||
    (candidate.endLineNumber !== undefined && !isLineNumber(candidate.endLineNumber))
  ) {
    return null
  }

  return createLineRangeTarget({
    fileKey: candidate.fileKey,
    filePath: candidate.filePath,
    side: candidate.side,
    lineNumber: candidate.lineNumber,
    endSide: candidate.endSide,
    endLineNumber: candidate.endLineNumber,
  })
}

function decodeReviewDraft(value: unknown): ReviewDraft | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as PersistedReviewDraft
  if (typeof candidate.body !== 'string') return null
  const purpose = decodeReviewPurpose(candidate.purpose)
  if (!purpose) return null
  const target = decodeReviewTarget(candidate.target) ?? decodeLegacyLineTarget(candidate)
  return target ? { target, body: candidate.body, purpose } : null
}

function decodeSavedReviewComment(value: unknown): SavedReviewComment | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as PersistedReviewDraft & { id?: unknown; createdAt?: unknown }
  const draft = decodeReviewDraft(candidate)
  if (!draft || typeof candidate.id !== 'string' || typeof candidate.createdAt !== 'string') {
    return null
  }
  return { ...draft, id: candidate.id, createdAt: candidate.createdAt }
}

export function decodePersistedReviewContext(value: unknown): ReviewContext | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as PersistedReviewContext
  const draft = decodeReviewDraft(candidate.draft)
  const comments = Array.isArray(candidate.comments)
    ? candidate.comments.map(decodeSavedReviewComment).filter((comment) => comment !== null)
    : []
  return comments.length === 0 && !draft ? null : { comments, draft }
}

function cloneTarget(target: ReviewTarget): ReviewTarget {
  return target.kind === 'file'
    ? { ...target }
    : { ...target, start: { ...target.start }, end: { ...target.end } }
}

function cloneDraft(draft: ReviewDraft | null): ReviewDraft | null {
  return draft ? { ...draft, target: cloneTarget(draft.target) } : null
}

function cloneComments(comments: readonly SavedReviewComment[]) {
  return comments.map((comment) => ({ ...comment, target: cloneTarget(comment.target) }))
}

function cloneContext(context: ReviewContext): ReviewContext {
  return { comments: cloneComments(context.comments), draft: cloneDraft(context.draft) }
}

function isContextEmpty(context: ReviewContext) {
  return context.comments.length === 0 && !context.draft
}

function serializeDraft(draft: ReviewDraft) {
  if (draft.target.kind === 'file') {
    return { target: cloneTarget(draft.target), body: draft.body, purpose: draft.purpose }
  }
  const { start, end } = draft.target
  return {
    fileKey: draft.target.fileKey,
    filePath: draft.target.filePath,
    side: start.side,
    lineNumber: start.lineNumber,
    ...(end.side === start.side ? {} : { endSide: end.side }),
    ...(end.lineNumber === start.lineNumber ? {} : { endLineNumber: end.lineNumber }),
    body: draft.body,
    purpose: draft.purpose,
  }
}

function serializeContexts(contextsById: Record<string, ReviewContext>): PersistedReviewState {
  return {
    version: 1,
    contextsById: Object.fromEntries(
      Object.entries(contextsById).map(([contextId, context]) => [
        contextId,
        {
          ...(context.comments.length > 0
            ? {
                comments: context.comments.map((comment) => ({
                  ...serializeDraft(comment),
                  id: comment.id,
                  createdAt: comment.createdAt,
                })),
              }
            : {}),
          ...(context.draft ? { draft: serializeDraft(context.draft) } : {}),
        },
      ]),
    ),
  }
}

function getDiffBaselineScopeKey(baseline: ProjectDiffBaseline | null) {
  if (!baseline) return 'head'
  if (baseline.kind === 'commit') return `commit:${baseline.sha}`
  if (baseline.kind === 'last-opened') return `last-opened:${baseline.rev}`
  return baseline.kind
}

export function getReviewContextId({
  baseline = null,
  includeUntracked = false,
  projectId,
}: {
  baseline?: ProjectDiffBaseline | null | undefined
  includeUntracked?: boolean | undefined
  projectId: string
}) {
  if (projectId.length === 0) return null
  return `project:${projectId}:worktree-diff:${getDiffBaselineScopeKey(baseline)}:untracked:${includeUntracked ? 'included' : 'hidden'}`
}

export function createReviewStore({
  storage = getBrowserStorage(),
  storageKey = DEFAULT_STORAGE_KEY,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  beforeUnloadTarget = getBeforeUnloadTarget(),
}: ReviewStoreOptions = {}) {
  let contextsById = hydratePersistedRecordMap({
    storage,
    storageKey,
    version: 1,
    recordKey: 'contextsById',
    toEntry: decodePersistedReviewContext,
  })
  let contextCount = Object.keys(contextsById).length
  const listeners = new Set<ReviewStoreListener>()

  const notifyListeners = () => {
    for (const listener of listeners) listener()
  }

  const persistence = createStoragePersistence({
    storage,
    storageKey,
    debounceMs,
    beforeUnloadTarget,
    hasEntries: () => contextCount > 0,
    serialize: () => serializeContexts(contextsById),
  })

  const writeContext = (contextId: string, context: ReviewContext) => {
    if (isContextEmpty(context)) {
      if (contextId in contextsById) {
        delete contextsById[contextId]
        contextCount -= 1
      }
    } else {
      const addsContext = !(contextId in contextsById)
      contextsById = { ...contextsById, [contextId]: cloneContext(context) }
      if (addsContext) contextCount += 1
    }
    notifyListeners()
    persistence.schedulePersist()
  }

  return {
    storageKey,
    getContext(contextId: string) {
      const context = contextsById[contextId]
      return context ? cloneContext(context) : null
    },
    setContext(contextId: string, context: ReviewContext) {
      writeContext(contextId, context)
    },
    clearContext(contextId: string) {
      if (!(contextId in contextsById)) return
      delete contextsById[contextId]
      contextCount -= 1
      notifyListeners()
      persistence.schedulePersist()
    },
    subscribe(listener: ReviewStoreListener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    flush: persistence.flush,
    destroy() {
      persistence.destroy()
    },
  }
}

export type ReviewStore = ReturnType<typeof createReviewStore>
export const reviewStore = createReviewStore()
