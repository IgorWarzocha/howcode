import {
  type PersistedRecordStoreOptions,
  createStoragePersistence,
  getBeforeUnloadTarget,
  getBrowserStorage,
  hydratePersistedRecordMap,
} from "../persistence/persistedRecordStore";

type AnnotationSide = "deletions" | "additions";

export type DiffCommentDraft = {
  fileKey: string;
  filePath: string;
  side: AnnotationSide;
  lineNumber: number;
  endSide?: AnnotationSide;
  endLineNumber?: number;
  body: string;
};

export type SavedDiffComment = DiffCommentDraft & {
  id: string;
  createdAt: string;
};

type DiffCommentContext = {
  comments: SavedDiffComment[];
  draft: DiffCommentDraft | null;
};

type PersistedDiffCommentContext = {
  comments?: SavedDiffComment[];
  draft?: DiffCommentDraft | null;
};

type PersistedDiffCommentState = {
  version: 1;
  contextsById: Record<string, PersistedDiffCommentContext>;
};

type DiffCommentStoreOptions = PersistedRecordStoreOptions;

type DiffCommentStoreListener = () => void;

const DEFAULT_STORAGE_KEY = "howcode:diff-comments:v1";
const DEFAULT_DEBOUNCE_MS = 320;

function isAnnotationSide(value: unknown): value is AnnotationSide {
  return value === "deletions" || value === "additions";
}

function isValidOptionalLineNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function toDraft(value: unknown): DiffCommentDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<DiffCommentDraft>;
  if (
    typeof candidate.fileKey !== "string" ||
    typeof candidate.filePath !== "string" ||
    !isAnnotationSide(candidate.side) ||
    typeof candidate.lineNumber !== "number" ||
    !isValidOptionalLineNumber(candidate.endLineNumber) ||
    (candidate.endSide !== undefined && !isAnnotationSide(candidate.endSide)) ||
    typeof candidate.body !== "string"
  ) {
    return null;
  }

  return {
    fileKey: candidate.fileKey,
    filePath: candidate.filePath,
    side: candidate.side,
    lineNumber: candidate.lineNumber,
    ...(candidate.endSide ? { endSide: candidate.endSide } : {}),
    ...(candidate.endLineNumber !== undefined ? { endLineNumber: candidate.endLineNumber } : {}),
    body: candidate.body,
  };
}

function toSavedComment(value: unknown): SavedDiffComment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<SavedDiffComment>;
  const draft = toDraft(candidate);
  if (!draft || typeof candidate.id !== "string" || typeof candidate.createdAt !== "string") {
    return null;
  }

  return {
    ...draft,
    id: candidate.id,
    createdAt: candidate.createdAt,
  };
}

function cloneDraft(draft: DiffCommentDraft | null): DiffCommentDraft | null {
  return draft ? { ...draft } : null;
}

function cloneComments(comments: SavedDiffComment[]) {
  return comments.map((comment) => ({ ...comment }));
}

function cloneContext(context: DiffCommentContext): DiffCommentContext {
  return {
    comments: cloneComments(context.comments),
    draft: cloneDraft(context.draft),
  };
}

function isContextEmpty(context: DiffCommentContext) {
  return context.comments.length === 0 && !context.draft;
}

function toContext(value: unknown): DiffCommentContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as PersistedDiffCommentContext;
  const draft = toDraft(candidate.draft);
  const comments = Array.isArray(candidate.comments)
    ? candidate.comments.map(toSavedComment).filter((comment) => comment !== null)
    : [];

  return comments.length === 0 && !draft ? null : { comments, draft };
}

function serializeContexts(
  contextsById: Record<string, DiffCommentContext>,
): PersistedDiffCommentState {
  return {
    version: 1,
    contextsById: Object.fromEntries(
      Object.entries(contextsById).map(([contextId, context]) => [
        contextId,
        {
          ...(context.comments.length > 0 ? { comments: cloneComments(context.comments) } : {}),
          ...(context.draft ? { draft: cloneDraft(context.draft) } : {}),
        },
      ]),
    ),
  };
}

export function getDiffCommentContextId({
  projectId,
}: {
  projectId: string;
}) {
  if (projectId.length === 0) {
    return null;
  }

  return `project:${projectId}:worktree-diff`;
}

export function createDiffCommentStore({
  storage = getBrowserStorage(),
  storageKey = DEFAULT_STORAGE_KEY,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  beforeUnloadTarget = getBeforeUnloadTarget(),
}: DiffCommentStoreOptions = {}) {
  let contextsById = hydratePersistedRecordMap({
    storage,
    storageKey,
    version: 1,
    recordKey: "contextsById",
    toEntry: toContext,
  });
  let contextCount = Object.keys(contextsById).length;
  const listeners = new Set<DiffCommentStoreListener>();

  const notifyListeners = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const persistence = createStoragePersistence({
    storage,
    storageKey,
    debounceMs,
    beforeUnloadTarget,
    hasEntries: () => contextCount > 0,
    serialize: () => serializeContexts(contextsById),
  });

  const writeContext = (contextId: string, context: DiffCommentContext) => {
    if (isContextEmpty(context)) {
      if (contextId in contextsById) {
        delete contextsById[contextId];
        contextCount -= 1;
      }
    } else {
      const addsContext = !(contextId in contextsById);
      contextsById = {
        ...contextsById,
        [contextId]: cloneContext(context),
      };
      if (addsContext) {
        contextCount += 1;
      }
    }

    notifyListeners();
    persistence.schedulePersist();
  };

  return {
    storageKey,
    getContext(contextId: string) {
      const context = contextsById[contextId];
      return context ? cloneContext(context) : null;
    },
    setContext(contextId: string, context: DiffCommentContext) {
      writeContext(contextId, context);
    },
    clearContext(contextId: string) {
      if (!(contextId in contextsById)) {
        return;
      }

      delete contextsById[contextId];
      contextCount -= 1;
      notifyListeners();
      persistence.schedulePersist();
    },
    subscribe(listener: DiffCommentStoreListener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    flush: persistence.flush,
    destroy() {
      persistence.destroy();
    },
  };
}

export const diffCommentStorageKey = DEFAULT_STORAGE_KEY;

export const diffCommentStore = createDiffCommentStore();
