export const DEFAULT_DICTATION_MAX_DURATION_SECONDS = 180;
export const DICTATION_MAX_DURATION_OPTIONS = [60, 180, 300, 600] as const;

export function normalizeDictationMaxDurationSeconds(value: number | null | undefined) {
  return DICTATION_MAX_DURATION_OPTIONS.find((option) => option === value) ?? null;
}
