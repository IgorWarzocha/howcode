import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { PiSkillsService, PiThreadsService } from '../../../shared/desktop-service-contracts'

type PiSkillsRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'searchPiSkills'
  | 'getConfiguredPiSkills'
  | 'installPiSkill'
  | 'removePiSkill'
  | 'getComposerSkills'
>

export function createPiSkillsHandlers(
  piSkills: PiSkillsService,
  piThreads: PiThreadsService,
): PiSkillsRequestHandlers {
  return {
    getComposerSkills: (request) => piThreads.loadComposerSkills(request),
    searchPiSkills: (request) => piSkills.searchPiSkills(request),
    getConfiguredPiSkills: (request) => piSkills.listConfiguredPiSkills(request),
    installPiSkill: (request) => piSkills.installPiSkill(request),
    removePiSkill: (request) => piSkills.removePiSkill(request),
  }
}
