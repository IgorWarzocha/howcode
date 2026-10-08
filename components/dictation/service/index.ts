import { createServiceWork } from '@howaboua/howcode-sdk/node/service-work'
import type { DictationService } from '../../../shared/desktop-service-contracts.ts'
import * as sherpa from './sherpa-onnx.ts'
import { resetRecognizerCache } from './sherpa-runtime.ts'

export function createDictationService() {
  const work = createServiceWork('Dictation')
  const downloads = new AbortController()
  const service: DictationService = {
    getDictationState: () => work.run(sherpa.getDictationState),
    listDictationModels: () => work.run(sherpa.listDictationModels),
    installDictationModel: ({ modelId }) =>
      work.run(() => sherpa.installDictationModel(modelId, downloads.signal)),
    removeDictationModel: ({ modelId }) => work.run(() => sherpa.removeDictationModel(modelId)),
    transcribeDictation: (request) => work.run(() => sherpa.transcribeDictation(request)),
  }
  return {
    service,
    async dispose() {
      downloads.abort()
      await work.stop()
      // Native recognizers have GC-owned handles, not a supported close API.
      resetRecognizerCache()
    },
  }
}
