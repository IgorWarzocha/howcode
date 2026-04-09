import type { View } from "../types";

export function getProjectSelectionAction(view: View) {
  return view === "extensions" || view === "skills" ? "set-selected-project" : "select-project";
}

export function shouldResetProjectScope(activeView: View, scopedView: "extensions" | "skills") {
  return activeView !== scopedView;
}
