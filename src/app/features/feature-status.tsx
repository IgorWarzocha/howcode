import { cn } from "../utils/cn";

export type FeatureStatus = "mock" | "partial";

export const featureStatusById = {
  "feature:sidebar.project.add": { status: "partial", label: "Partial" },
  "feature:header.project-switch": { status: "mock", label: "Mock" },
  "feature:header.commit": { status: "partial", label: "Partial" },
  "feature:header.commit-options": { status: "partial", label: "Partial" },
  "feature:composer.git-ops": { status: "partial", label: "Partial" },
  "feature:composer.terminal-toggle": { status: "partial", label: "Partial" },
  "feature:skills.create": { status: "partial", label: "Partial" },
  "feature:diff.panel": { status: "partial", label: "Partial" },
  "feature:terminal.panel": { status: "partial", label: "Partial" },
  "feature:settings.menu.skills": { status: "partial", label: "Partial" },
  "feature:settings.menu.settings": { status: "partial", label: "Partial" },
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
    : "border-[rgba(169,178,215,0.18)] text-[color:var(--muted)] hover:border-[rgba(169,178,215,0.28)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[color:var(--text)]";
}

export function getFeatureStatusBadgeClass(statusId: FeatureStatusId) {
  return cn(featureStatusBadgeBaseClass, getFeatureStatusAccentClass(statusId));
}
