import type { DesktopRequestHandlerMap } from '../../../../../shared/desktop-ipc'
import type { SkillCreatorService } from '../../../../../shared/desktop-service-contracts'

type SkillCreatorRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  'startSkillCreatorSession' | 'continueSkillCreatorSession' | 'closeSkillCreatorSession'
>

export function createSkillCreatorHandlers(
  skillCreator: SkillCreatorService,
): SkillCreatorRequestHandlers {
  return {
    startSkillCreatorSession: (request) => skillCreator.startSkillCreatorSession(request),
    continueSkillCreatorSession: (request) => skillCreator.continueSkillCreatorSession(request),
    closeSkillCreatorSession: (request) => skillCreator.closeSkillCreatorSession(request),
  }
}
