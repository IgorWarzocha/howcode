export type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export type BeforeUnloadTarget = Pick<Window, "addEventListener" | "removeEventListener">;

export type PersistedRecordStoreOptions = {
  storage?: StorageLike | null;
  storageKey?: string;
  debounceMs?: number;
  beforeUnloadTarget?: BeforeUnloadTarget | null;
};

type HydratePersistedRecordMapOptions<Entry> = {
  storage: StorageLike | null;
  storageKey: string;
  version: number;
  recordKey: string;
  toEntry: (value: unknown) => Entry | null;
};

type StoragePersistenceOptions = {
  storage: StorageLike | null;
  storageKey: string;
  debounceMs: number;
  beforeUnloadTarget: BeforeUnloadTarget | null;
  hasEntries: () => boolean;
  serialize: () => unknown;
  failureComment?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getBeforeUnloadTarget() {
  if (typeof window === "undefined") {
    return null;
  }

  return window;
}

export function hydratePersistedRecordMap<Entry>({
  storage,
  storageKey,
  version,
  recordKey,
  toEntry,
}: HydratePersistedRecordMapOptions<Entry>) {
  if (!storage) {
    return {} satisfies Record<string, Entry>;
  }

  try {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) {
      return {} satisfies Record<string, Entry>;
    }

    const parsed = JSON.parse(rawValue);
    if (!isRecord(parsed) || parsed.version !== version || !isRecord(parsed[recordKey])) {
      return {} satisfies Record<string, Entry>;
    }

    return Object.entries(parsed[recordKey]).reduce<Record<string, Entry>>(
      (current, [entryId, value]) => {
        const entry = toEntry(value);
        if (entry) {
          current[entryId] = entry;
        }

        return current;
      },
      {},
    );
  } catch {
    return {} satisfies Record<string, Entry>;
  }
}

export function createStoragePersistence({
  storage,
  storageKey,
  debounceMs,
  beforeUnloadTarget,
  hasEntries,
  serialize,
}: StoragePersistenceOptions) {
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
      if (!hasEntries()) {
        storage.removeItem(storageKey);
        return;
      }

      storage.setItem(storageKey, JSON.stringify(serialize()));
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

  const handleBeforeUnload = () => {
    flush();
  };

  beforeUnloadTarget?.addEventListener("beforeunload", handleBeforeUnload);

  return {
    flush,
    schedulePersist,
    destroy() {
      clearPersistTimeout();
      beforeUnloadTarget?.removeEventListener("beforeunload", handleBeforeUnload);
    },
  };
}
