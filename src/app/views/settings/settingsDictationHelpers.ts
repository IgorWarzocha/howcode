import type { DictationModelId } from '../../desktop/types'

export function normalizeManagedDictationModelId(
  modelId: string | null | undefined,
): DictationModelId | null {
  return modelId === 'tiny.en' || modelId === 'base.en' || modelId === 'small.en' ? modelId : null
}
