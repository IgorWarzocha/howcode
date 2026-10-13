import type { PiSkillsService } from '@howaboua/howcode-skills/contracts'
import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'

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
