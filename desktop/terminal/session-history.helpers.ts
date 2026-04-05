const MAX_HISTORY_CHARS = 200_000;

export function clampHistory(history: string) {
  return history.length > MAX_HISTORY_CHARS ? history.slice(-MAX_HISTORY_CHARS) : history;
}
