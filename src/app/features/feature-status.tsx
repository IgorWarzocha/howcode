import { cn } from "../utils/cn";

export type FeatureStatus = "mock" | "partial";

export const featureStatusById = {
  "feature:sidebar.inbox": { status: "partial", label: "Partial" },
  "feature:sidebar.plugins": { status: "mock", label: "Mock" },
  "feature:sidebar.automations": { status: "mock", label: "Mock" },
  "feature:sidebar.debug": { status: "mock", label: "Mock" },
  "feature:sidebar.threads.filter": { status: "partial", label: "Partial" },
  "feature:sidebar.project.add": { status: "partial", label: "Partial" },
  "feature:sidebar.project.actions": { status: "partial", label: "Partial" },
  "feature:header.project-switch": { status: "mock", label: "Mock" },
  "feature:header.thread-actions": { status: "mock", label: "Mock" },
  "feature:header.thread-run-action": { status: "mock", label: "Mock" },
  "feature:header.open": { status: "mock", label: "Mock" },
  "feature:header.open-options": { status: "mock", label: "Mock" },
  "feature:header.handoff": { status: "mock", label: "Mock" },
  "feature:header.commit": { status: "partial", label: "Partial" },
  "feature:header.commit-options": { status: "partial", label: "Partial" },
  "feature:header.workspace-popout": { status: "mock", label: "Mock" },
  "feature:composer.remote-connections": { status: "mock", label: "Mock" },
  "feature:composer.connections.add": { status: "mock", label: "Mock" },
  "feature:composer.connections.dismiss": { status: "mock", label: "Mock" },
  "feature:composer.dictate": { status: "mock", label: "Mock" },
  "feature:composer.git-ops": { status: "partial", label: "Partial" },
  "feature:composer.terminal-toggle": { status: "partial", label: "Partial" },
  "feature:composer.host": { status: "mock", label: "Mock" },
  "feature:views.plugins": { status: "mock", label: "Mock" },
  "feature:views.automations": { status: "mock", label: "Mock" },
  "feature:views.debug": { status: "mock", label: "Mock" },
  "feature:skills.create": { status: "partial", label: "Partial" },
  "feature:diff.panel": { status: "partial", label: "Partial" },
  "feature:diff.review": { status: "mock", label: "Mock" },
  "feature:terminal.panel": { status: "partial", label: "Partial" },
  "feature:settings.menu.skills": { status: "partial", label: "Partial" },
  "feature:settings.menu.settings": { status: "partial", label: "Partial" },
  "feature:settings.menu.rate-limits": { status: "mock", label: "Mock" },
} as const satisfies Record<string, { status: FeatureStatus; label: string }>;

export type FeatureStatusId = keyof typeof featureStatusById;

const featureStatusBadgeBaseClass =
  "inline-flex items-center rounded-full border px-1.5 py-[1px] text-[10px] font-medium uppercase tracking-[0.08em]";

export function getFeatureStatusMeta(statusId: FeatureStatusId) {
  return featureStatusById[statusId];
}

export function getFeatureStatusDataAttributes(statusId: FeatureStatusId) {
  return {
    "data-feature-id": statusId,
    "data-feature-status": getFeatureStatusMeta(statusId).status,
  } as const;
}

export function getFeatureStatusAccentClass(statusId: FeatureStatusId) {
  return getFeatureStatusMeta(statusId).status === "mock"
    ? "border-[rgba(255,110,110,0.42)] bg-[rgba(255,94,94,0.14)] text-[#ff9c9c]"
    : "border-[rgba(255,214,102,0.4)] bg-[rgba(255,204,102,0.14)] text-[#ffd36a]";
}

export function getFeatureStatusButtonClass(statusId: FeatureStatusId) {
  return getFeatureStatusMeta(statusId).status === "mock"
    ? "border-[rgba(255,110,110,0.22)] text-[#ff9c9c] hover:border-[rgba(255,110,110,0.36)] hover:bg-[rgba(255,94,94,0.08)] hover:text-[#ffd1d1]"
    : "border-[rgba(255,214,102,0.22)] text-[#ffd36a] hover:border-[rgba(255,214,102,0.34)] hover:bg-[rgba(255,204,102,0.08)] hover:text-[#ffe297]";
}

export function getFeatureStatusBadgeClass(statusId: FeatureStatusId) {
  return cn(featureStatusBadgeBaseClass, getFeatureStatusAccentClass(statusId));
}
