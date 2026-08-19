export const composerThinkingLevels = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const

const composerThinkingLevelSet = new Set<string>(composerThinkingLevels)

export function isComposerThinkingLevel(
  value: unknown,
): value is (typeof composerThinkingLevels)[number] {
  return typeof value === 'string' && composerThinkingLevelSet.has(value)
}
