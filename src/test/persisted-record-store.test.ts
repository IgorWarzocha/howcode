import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStoragePersistence,
  hydratePersistedRecordMap,
  type StorageLike,
} from "../app/components/workspace/persistence/persistedRecordStore";
import { createMemoryStorage } from "./helpers/storage";

describe("persistedRecordStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydrates versioned records and drops invalid entries", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "records",
      JSON.stringify({
        version: 1,
        recordsById: {
          valid: { value: "kept" },
          invalid: { value: 42 },
        },
      }),
    );

    expect(
      hydratePersistedRecordMap({
        storage,
        storageKey: "records",
        version: 1,
        recordKey: "recordsById",
        toEntry: (value) =>
          value && typeof value === "object" && "value" in value && typeof value.value === "string"
            ? { value: value.value }
            : null,
      }),
    ).toEqual({ valid: { value: "kept" } });
  });

  it("ignores malformed storage payloads", () => {
    const storage = createMemoryStorage();
    storage.setItem("records", "not json");

    expect(
      hydratePersistedRecordMap({
        storage,
        storageKey: "records",
        version: 1,
        recordKey: "recordsById",
        toEntry: () => ({ value: "unused" }),
      }),
    ).toEqual({});
  });

  it("debounces writes and removes empty persisted state", () => {
    const storage = createMemoryStorage();
    let entries: Record<string, { value: string }> = { first: { value: "one" } };
    const persistence = createStoragePersistence({
      storage,
      storageKey: "records",
      debounceMs: 300,
      beforeUnloadTarget: null,
      hasEntries: () => Object.keys(entries).length > 0,
      serialize: () => ({ version: 1, recordsById: entries }),
    });

    persistence.schedulePersist();
    vi.advanceTimersByTime(299);
    expect(storage.getItem("records")).toBeNull();

    vi.advanceTimersByTime(1);
    expect(JSON.parse(storage.getItem("records") ?? "null")).toEqual({
      version: 1,
      recordsById: { first: { value: "one" } },
    });

    entries = {};
    persistence.flush();
    expect(storage.getItem("records")).toBeNull();
  });

  it("keeps memory state usable when storage writes fail", () => {
    const storage: StorageLike = {
      getItem: () => null,
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const persistence = createStoragePersistence({
      storage,
      storageKey: "records",
      debounceMs: 300,
      beforeUnloadTarget: null,
      hasEntries: () => true,
      serialize: () => ({ version: 1, recordsById: { first: { value: "one" } } }),
    });

    expect(() => persistence.flush()).not.toThrow();
  });
});
