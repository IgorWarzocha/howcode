/**
 * When true, the Pi session JSONL watcher also signals the composer session tree to
 * refetch (see `desktop/pi-threads/session-watch.ts` and thread-update handling).
 * Set false before ship if the tree should only load when the user opens `/tree`.
 */
export const sessionTreeRefreshWithSessionWatch = true
