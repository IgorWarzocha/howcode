type AnnotationSide = "deletions" | "additions";

export type DiffCommentDraft = {
  fileKey: string;
  filePath: string;
  side: AnnotationSide;
  lineNumber: number;
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

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type BeforeUnloadTarget = Pick<Window, "addEventListener" | "removeEventListener">;

type DiffCommentStoreOptions = {
  storage?: StorageLike | null;
  storageKey?: string;
  debounceMs?: number;
  beforeUnloadTarget?: BeforeUnloadTarget | null;
};

type DiffCommentStoreListener = () => void;

const DEFAULT_STORAGE_KEY = "howcode:diff-comments:v1";
const DEFAULT_DEBOUNCE_MS = 320;

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getBeforeUnloadTarget() {
  if (typeof window === "undefined") {
    return null;
  }

  return window;
}

function isAnnotationSide(value: unknown): value is AnnotationSide {
  return value === "deletions" || value === "additions";
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
    typeof candidate.body !== "string"
  ) {
    return null;
  }

  return {
    fileKey: candidate.fileKey,
    filePath: candidate.filePath,
    side: candidate.side,
    lineNumber: candidate.lineNumber,
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

function hydrateContexts(storage: StorageLike | null, storageKey: string) {
  if (!storage) {
    return {} satisfies Record<string, DiffCommentContext>;
  }

  try {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) {
      return {} satisfies Record<string, DiffCommentContext>;
    }

    const parsed = JSON.parse(rawValue) as PersistedDiffCommentState;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== 1 ||
      !parsed.contextsById ||
      typeof parsed.contextsById !== "object"
    ) {
      return {} satisfies Record<string, DiffCommentContext>;
    }

    return Object.entries(parsed.contextsById).reduce<Record<string, DiffCommentContext>>(
      (current, [contextId, value]) => {
        const draft = toDraft(value?.draft);
        const comments = Array.isArray(value?.comments)
          ? value.comments.map(toSavedComment).filter((comment) => comment !== null)
          : [];
        if (comments.length === 0 && !draft) {
          return current;
        }

        current[contextId] = {
          comments: comments as SavedDiffComment[],
          draft,
        };
        return current;
      },
      {},
    );
  } catch {
    return {} satisfies Record<string, DiffCommentContext>;
  }
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
  let contextsById = hydrateContexts(storage, storageKey);
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<DiffCommentStoreListener>();

  const notifyListeners = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const clearPersistTimeout = () => {
    if (persistTimeout === null) {
      return;
    }

    clearTimeout(persistTimeout);
    persistTimeout = null;
  };

  const flush = () => {
    clearPersistTimeout();

    if (!storage) {
      return;
    }

    try {
      if (Object.keys(contextsById).length === 0) {
        storage.removeItem(storageKey);
        return;
      }

      storage.setItem(storageKey, JSON.stringify(serializeContexts(contextsById)));
    } catch {
      // Ignore storage failures and keep the in-memory cache available.
    }
  };

  const schedulePersist = () => {
    if (!storage) {
      return;
    }

    clearPersistTimeout();
    persistTimeout = setTimeout(() => {
      flush();
    }, debounceMs);
  };

  const writeContext = (contextId: string, context: DiffCommentContext) => {
    if (isContextEmpty(context)) {
      delete contextsById[contextId];
    } else {
      contextsById = {
        ...contextsById,
        [contextId]: cloneContext(context),
      };
    }

    notifyListeners();
    schedulePersist();
  };

  const handleBeforeUnload = () => {
    flush();
  };

  beforeUnloadTarget?.addEventListener("beforeunload", handleBeforeUnload);

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
      notifyListeners();
      schedulePersist();
    },
    subscribe(listener: DiffCommentStoreListener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    flush,
    destroy() {
      clearPersistTimeout();
      beforeUnloadTarget?.removeEventListener("beforeunload", handleBeforeUnload);
    },
  };
}

export const diffCommentStorageKey = DEFAULT_STORAGE_KEY;

export const diffCommentStore = createDiffCommentStore();
