import { useLayoutEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { AppSettings } from "../desktop/types";
import type { WorkspaceAction, WorkspaceState } from "../state/workspace";

type UseTakeoverVisibilitySyncInput = {
  shellAppSettings: AppSettings | null | undefined;
  workspaceState: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
};

export function useTakeoverVisibilitySync({
  shellAppSettings,
  workspaceState,
  dispatch,
}: UseTakeoverVisibilitySyncInput) {
  const lastAppliedThreadPreferenceKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const visibleThreadKey =
      workspaceState.activeView === "thread" && workspaceState.selectedSessionPath
        ? workspaceState.selectedSessionPath
        : null;

    if (!visibleThreadKey) {
      lastAppliedThreadPreferenceKeyRef.current = null;
      return;
    }

    const globalTakeoverVisible = shellAppSettings?.piTuiTakeover ?? false;
    const sessionOverrideVisible = workspaceState.takeoverOverrides[visibleThreadKey];
    const effectiveTakeoverVisible = sessionOverrideVisible ?? globalTakeoverVisible;
    const visibleThreadPreferenceKey = `${visibleThreadKey}:${effectiveTakeoverVisible}`;

    if (lastAppliedThreadPreferenceKeyRef.current === visibleThreadPreferenceKey) {
      return;
    }

    lastAppliedThreadPreferenceKeyRef.current = visibleThreadPreferenceKey;
    dispatch({ type: "set-takeover-visible", visible: effectiveTakeoverVisible });
  }, [
    dispatch,
    shellAppSettings?.piTuiTakeover,
    workspaceState.activeView,
    workspaceState.takeoverOverrides,
    workspaceState.selectedSessionPath,
  ]);
}
