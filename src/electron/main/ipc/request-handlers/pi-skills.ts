import type { DesktopRequestHandlerMap } from '../../../../../shared/desktop-ipc'
import type { PiSkillsService } from '../../../../../shared/desktop-service-contracts'

type PiSkillsRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  'searchPiSkills' | 'getConfiguredPiSkills' | 'installPiSkill' | 'removePiSkill'
>

export function createPiSkillsHandlers(piSkills: PiSkillsService): PiSkillsRequestHandlers {
  return {
    searchPiSkills: (request) => piSkills.searchPiSkills(request),
    getConfiguredPiSkills: (request) => piSkills.listConfiguredPiSkills(request),
    installPiSkill: (request) => piSkills.installPiSkill(request),
    removePiSkill: (request) => piSkills.removePiSkill(request),
  }
}
