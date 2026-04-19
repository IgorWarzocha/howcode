import { getLocalDraftProjectId } from "../../../../../shared/session-paths";

import type { ComposerAttachment } from "../../../desktop/types";

type ComposerDraft = {
  prompt: string;
  attachments: ComposerAttachment[];
};

type PersistedComposerDraft = {
  prompt: string;
  attachments?: ComposerAttachment[];
};

type PersistedComposerDraftState = {
  version: 1;
  draftsByThreadId: Record<string, PersistedComposerDraft>;
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type BeforeUnloadTarget = Pick<Window, "addEventListener" | "removeEventListener">;

type ComposerDraftStoreOptions = {
  storage?: StorageLike | null;
  storageKey?: string;
  debounceMs?: number;
  beforeUnloadTarget?: BeforeUnloadTarget | null;
};

const DEFAULT_STORAGE_KEY = "howcode:composer-drafts:v1";
const DEFAULT_DEBOUNCE_MS = 320;

function cloneAttachments(attachments: ComposerAttachment[]) {
  return attachments.map((attachment) => ({ ...attachment }));
}

function cloneDraft(draft: ComposerDraft): ComposerDraft {
  return {
    prompt: draft.prompt,
    attachments: cloneAttachments(draft.attachments),
  };
}

function isComposerAttachment(value: unknown): value is ComposerAttachment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ComposerAttachment>;

  return (
    typeof candidate.path === "string" &&
    typeof candidate.name === "string" &&
    (candidate.kind === "directory" || candidate.kind === "text" || candidate.kind === "image")
  );
}

function toDraft(value: unknown): ComposerDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PersistedComposerDraft>;

  const prompt = typeof candidate.prompt === "string" ? candidate.prompt : "";
  const attachments = Array.isArray(candidate.attachments)
    ? candidate.attachments.filter(isComposerAttachment).map((attachment) => ({ ...attachment }))
    : [];

  if (prompt.length === 0 && attachments.length === 0) {
    return null;
  }

  return { prompt, attachments };
}

function hydrateDrafts(storage: StorageLike | null, storageKey: string) {
  if (!storage) {
    return {} satisfies Record<string, ComposerDraft>;
  }

  try {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) {
      return {} satisfies Record<string, ComposerDraft>;
    }

    const parsed = JSON.parse(rawValue) as PersistedComposerDraftState;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== 1 ||
      !parsed.draftsByThreadId ||
      typeof parsed.draftsByThreadId !== "object"
    ) {
      return {} satisfies Record<string, ComposerDraft>;
    }

    const draftsByThreadId = Object.entries(parsed.draftsByThreadId).reduce<
      Record<string, ComposerDraft>
    >((current, [threadId, draftValue]) => {
      const draft = toDraft(draftValue);
      if (draft) {
        current[threadId] = draft;
      }

      return current;
    }, {});

    return draftsByThreadId;
  } catch {
    return {} satisfies Record<string, ComposerDraft>;
  }
}

function serializeDrafts(
  draftsByThreadId: Record<string, ComposerDraft>,
): PersistedComposerDraftState {
  return {
    version: 1,
    draftsByThreadId: Object.fromEntries(
      Object.entries(draftsByThreadId).map(([threadId, draft]) => [
        threadId,
        {
          prompt: draft.prompt,
          ...(draft.attachments.length > 0
            ? { attachments: cloneAttachments(draft.attachments) }
            : {}),
        },
      ]),
    ),
  };
}

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

export function getComposerDraftThreadId({
  projectId,
  sessionPath,
}: {
  projectId: string;
  sessionPath: string | null;
}) {
  if (typeof sessionPath === "string" && sessionPath.length > 0) {
    return `session:${sessionPath}`;
  }

  return projectId.length > 0 ? `project:${projectId}:new-thread` : null;
}

export function createComposerDraftStore({
  storage = getBrowserStorage(),
  storageKey = DEFAULT_STORAGE_KEY,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  beforeUnloadTarget = getBeforeUnloadTarget(),
}: ComposerDraftStoreOptions = {}) {
  let draftsByThreadId = hydrateDrafts(storage, storageKey);
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;

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
      if (Object.keys(draftsByThreadId).length === 0) {
        storage.removeItem(storageKey);
        return;
      }

      storage.setItem(storageKey, JSON.stringify(serializeDrafts(draftsByThreadId)));
    } catch {
      // Ignore storage failures and keep the in-memory draft cache available.
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

  const getMirroredProjectDraftThreadId = (threadId: string) => {
    if (!threadId.startsWith("session:")) {
      return null;
    }

    const projectId = getLocalDraftProjectId(threadId.slice("session:".length));
    return projectId ? `project:${projectId}:new-thread` : null;
  };

  const areDraftsEqual = (left: ComposerDraft | undefined, right: ComposerDraft | undefined) => {
    if (!left || !right) {
      return false;
    }

    return JSON.stringify(left) === JSON.stringify(right);
  };

  const writeDraft = (threadId: string, nextDraft: ComposerDraft) => {
    const mirroredThreadId = getMirroredProjectDraftThreadId(threadId);
    const previousDraft = draftsByThreadId[threadId];

    if (nextDraft.prompt.length === 0 && nextDraft.attachments.length === 0) {
      delete draftsByThreadId[threadId];

      if (mirroredThreadId && areDraftsEqual(draftsByThreadId[mirroredThreadId], previousDraft)) {
        delete draftsByThreadId[mirroredThreadId];
      }
    } else {
      draftsByThreadId = {
        ...draftsByThreadId,
        [threadId]: cloneDraft(nextDraft),
        ...(mirroredThreadId ? { [mirroredThreadId]: cloneDraft(nextDraft) } : {}),
      };
    }

    schedulePersist();
  };

  const updateDraft = (
    threadId: string,
    updater: (currentDraft: ComposerDraft) => ComposerDraft,
  ) => {
    const currentDraft = draftsByThreadId[threadId] ?? { prompt: "", attachments: [] };
    writeDraft(threadId, updater(currentDraft));
  };

  const handleBeforeUnload = () => {
    flush();
  };

  beforeUnloadTarget?.addEventListener("beforeunload", handleBeforeUnload);

  return {
    storageKey,
    getDraft(threadId: string) {
      const draft = draftsByThreadId[threadId];
      return draft ? cloneDraft(draft) : null;
    },
    setDraft(threadId: string, draft: ComposerDraft) {
      writeDraft(threadId, draft);
    },
    setPrompt(threadId: string, prompt: string) {
      updateDraft(threadId, (currentDraft) => ({
        ...currentDraft,
        prompt,
      }));
    },
    setAttachments(threadId: string, attachments: ComposerAttachment[]) {
      updateDraft(threadId, (currentDraft) => ({
        ...currentDraft,
        attachments: cloneAttachments(attachments),
      }));
    },
    clearComposerContent(threadId: string) {
      writeDraft(threadId, { prompt: "", attachments: [] });
    },
    clearThreadDraft(threadId: string) {
      if (!(threadId in draftsByThreadId)) {
        return;
      }

      const mirroredThreadId = getMirroredProjectDraftThreadId(threadId);
      const previousDraft = draftsByThreadId[threadId];

      draftsByThreadId = Object.fromEntries(
        Object.entries(draftsByThreadId).filter(
          ([currentThreadId, currentDraft]) =>
            currentThreadId !== threadId &&
            !(
              mirroredThreadId &&
              currentThreadId === mirroredThreadId &&
              areDraftsEqual(currentDraft, previousDraft)
            ),
        ),
      );
      schedulePersist();
    },
    flush,
    destroy() {
      clearPersistTimeout();
      beforeUnloadTarget?.removeEventListener("beforeunload", handleBeforeUnload);
    },
  };
}

export const composerDraftStorageKey = DEFAULT_STORAGE_KEY;

export const composerDraftStore = createComposerDraftStore();

export type { ComposerDraft };
