import { getLocalDraftProjectId } from "../../../../../shared/session-paths";

import type { ComposerAttachment } from "../../../desktop/types";
import {
  type PersistedRecordStoreOptions,
  createStoragePersistence,
  getBeforeUnloadTarget,
  getBrowserStorage,
  hydratePersistedRecordMap,
} from "../persistence/persistedRecordStore";

type ComposerDraft = {
  prompt: string;
  attachments: ComposerAttachment[];
  pickerOpen: boolean;
};

type PersistedComposerDraft = {
  prompt: string;
  attachments?: ComposerAttachment[];
  pickerOpen?: boolean;
};

type PersistedComposerDraftState = {
  version: 1;
  draftsByThreadId: Record<string, PersistedComposerDraft>;
};

type ComposerDraftStoreOptions = PersistedRecordStoreOptions;

const DEFAULT_STORAGE_KEY = "howcode:composer-drafts:v1";
const DEFAULT_DEBOUNCE_MS = 320;

function cloneAttachments(attachments: ComposerAttachment[]) {
  return attachments.map((attachment) => ({ ...attachment }));
}

function cloneDraft(draft: ComposerDraft): ComposerDraft {
  return {
    prompt: draft.prompt,
    attachments: cloneAttachments(draft.attachments),
    pickerOpen: draft.pickerOpen,
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
  const pickerOpen = candidate.pickerOpen === true;

  if (prompt.length === 0 && attachments.length === 0 && !pickerOpen) {
    return null;
  }

  return { prompt, attachments, pickerOpen };
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
          ...(draft.pickerOpen ? { pickerOpen: true } : {}),
          ...(draft.attachments.length > 0
            ? { attachments: cloneAttachments(draft.attachments) }
            : {}),
        },
      ]),
    ),
  };
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
  let draftsByThreadId = hydratePersistedRecordMap({
    storage,
    storageKey,
    version: 1,
    recordKey: "draftsByThreadId",
    toEntry: toDraft,
  });
  let draftCount = Object.keys(draftsByThreadId).length;

  const persistence = createStoragePersistence({
    storage,
    storageKey,
    debounceMs,
    beforeUnloadTarget,
    hasEntries: () => draftCount > 0,
    serialize: () => serializeDrafts(draftsByThreadId),
  });

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

    if (
      left.prompt !== right.prompt ||
      left.pickerOpen !== right.pickerOpen ||
      left.attachments.length !== right.attachments.length
    ) {
      return false;
    }

    return left.attachments.every((leftAttachment, index) => {
      const rightAttachment = right.attachments[index];
      return (
        rightAttachment !== undefined &&
        leftAttachment.path === rightAttachment.path &&
        leftAttachment.name === rightAttachment.name &&
        leftAttachment.kind === rightAttachment.kind
      );
    });
  };

  const writeDraft = (threadId: string, nextDraft: ComposerDraft) => {
    const mirroredThreadId = getMirroredProjectDraftThreadId(threadId);
    const previousDraft = draftsByThreadId[threadId];

    if (
      nextDraft.prompt.length === 0 &&
      nextDraft.attachments.length === 0 &&
      !nextDraft.pickerOpen
    ) {
      if (threadId in draftsByThreadId) {
        delete draftsByThreadId[threadId];
        draftCount -= 1;
      }

      if (mirroredThreadId && areDraftsEqual(draftsByThreadId[mirroredThreadId], previousDraft)) {
        delete draftsByThreadId[mirroredThreadId];
        draftCount -= 1;
      }
    } else {
      const addsThreadDraft = !(threadId in draftsByThreadId);
      const addsMirroredDraft = Boolean(
        mirroredThreadId && !(mirroredThreadId in draftsByThreadId),
      );
      draftsByThreadId = {
        ...draftsByThreadId,
        [threadId]: cloneDraft(nextDraft),
        ...(mirroredThreadId ? { [mirroredThreadId]: cloneDraft(nextDraft) } : {}),
      };
      draftCount += (addsThreadDraft ? 1 : 0) + (addsMirroredDraft ? 1 : 0);
    }

    persistence.schedulePersist();
  };

  const updateDraft = (
    threadId: string,
    updater: (currentDraft: ComposerDraft) => ComposerDraft,
  ) => {
    const currentDraft = draftsByThreadId[threadId] ?? {
      prompt: "",
      attachments: [],
      pickerOpen: false,
    };
    writeDraft(threadId, updater(currentDraft));
  };

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
      writeDraft(threadId, { prompt: "", attachments: [], pickerOpen: false });
    },
    clearThreadDraft(threadId: string) {
      if (!(threadId in draftsByThreadId)) {
        return;
      }

      const mirroredThreadId = getMirroredProjectDraftThreadId(threadId);
      const previousDraft = draftsByThreadId[threadId];

      delete draftsByThreadId[threadId];
      draftCount -= 1;

      if (mirroredThreadId && areDraftsEqual(draftsByThreadId[mirroredThreadId], previousDraft)) {
        delete draftsByThreadId[mirroredThreadId];
        draftCount -= 1;
      }
      persistence.schedulePersist();
    },
    flush: persistence.flush,
    destroy() {
      persistence.destroy();
    },
  };
}

export const composerDraftStorageKey = DEFAULT_STORAGE_KEY;

export const composerDraftStore = createComposerDraftStore();

export type { ComposerDraft };
