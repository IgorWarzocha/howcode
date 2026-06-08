/**
 * When true, the Pi session JSONL watcher also signals the composer session tree to
 * refetch while the tree panel is open (see `desktop/pi-threads/session-watch.ts` and
 * thread-update handling). Set false to refetch only when the user opens `/tree`.
 */
export const sessionTreeRefreshWithSessionWatch = false
