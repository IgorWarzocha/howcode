export async function getDictationStateQuery() {
  return (await window.piDesktop?.getDictationState?.().catch(() => null)) ?? null
}

export async function listDictationModelsQuery() {
  return (await window.piDesktop?.listDictationModels?.().catch(() => [])) ?? []
}

export async function installDictationModelQuery(
  modelId: import('../../../src/app/desktop/types').DictationModelId,
) {
  return (await window.piDesktop?.installDictationModel?.(modelId)) ?? null
}

export async function removeDictationModelQuery(
  modelId: import('../../../src/app/desktop/types').DictationModelId,
) {
  return (await window.piDesktop?.removeDictationModel?.(modelId)) ?? null
}

export async function transcribeDictationQuery(
  request: import('../../../src/app/desktop/types').DictationTranscriptionRequest,
) {
  return (await window.piDesktop?.transcribeDictation?.(request)) ?? null
}

export function canTranscribeDictationQuery() {
  return (
    typeof window !== 'undefined' && typeof window.piDesktop?.transcribeDictation === 'function'
  )
}
