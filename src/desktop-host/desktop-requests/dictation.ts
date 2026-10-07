import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { PiThreadsService } from '../../../shared/desktop-service-contracts'

type DictationRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'getDictationState'
  | 'listDictationModels'
  | 'installDictationModel'
  | 'removeDictationModel'
  | 'transcribeDictation'
>

export function createDictationHandlers(piThreads: PiThreadsService): DictationRequestHandlers {
  return {
    getDictationState: () => piThreads.getDictationState(),
    listDictationModels: () => piThreads.listDictationModels(),
    installDictationModel: (request) => piThreads.installDictationModel(request),
    removeDictationModel: (request) => piThreads.removeDictationModel(request),
    transcribeDictation: (request) => piThreads.transcribeDictation(request),
  }
}
