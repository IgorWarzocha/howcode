import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DictationService } from '../../../shared/desktop-service-contracts'

type DictationRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'getDictationState'
  | 'listDictationModels'
  | 'installDictationModel'
  | 'removeDictationModel'
  | 'transcribeDictation'
>

export function createDictationHandlers(dictation: DictationService): DictationRequestHandlers {
  return {
    getDictationState: () => dictation.getDictationState(),
    listDictationModels: () => dictation.listDictationModels(),
    installDictationModel: (request) => dictation.installDictationModel(request),
    removeDictationModel: (request) => dictation.removeDictationModel(request),
    transcribeDictation: (request) => dictation.transcribeDictation(request),
  }
}
