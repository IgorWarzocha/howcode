import { useRef } from "react";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from "../ui/layout";

type UseAppShellLayoutStateInput = {
  takeoverVisible: boolean;
};

export function useAppShellLayoutState({ takeoverVisible }: UseAppShellLayoutStateInput) {
  const mainSectionRef = useRef<HTMLElement>(null);
  const takeoverPresent = useAnimatedPresence(takeoverVisible);
  const desktopWorkspacePresent = useAnimatedPresence(!takeoverVisible);

  return {
    mainSectionRef,
    takeoverPresent,
    desktopWorkspacePresent,
    workspaceContentClass: `mx-auto w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS}`,
  };
}
