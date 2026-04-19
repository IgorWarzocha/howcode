import type { DesktopRequestHandlerMap } from "../../../../../shared/desktop-ipc";
import type { SkillCreatorModule } from "../../runtime/desktop-runtime-contracts";

type SkillCreatorRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  "startSkillCreatorSession" | "continueSkillCreatorSession" | "closeSkillCreatorSession"
>;

export function createSkillCreatorHandlers(
  skillCreator: SkillCreatorModule,
): SkillCreatorRequestHandlers {
  return {
    startSkillCreatorSession: (request) => skillCreator.startSkillCreatorSession(request),
    continueSkillCreatorSession: (request) => skillCreator.continueSkillCreatorSession(request),
    closeSkillCreatorSession: (request) => skillCreator.closeSkillCreatorSession(request),
  };
}
