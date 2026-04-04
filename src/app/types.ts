import type { LucideIcon } from "lucide-react";

export type {
  ArchivedThread,
  Message,
  Project,
  Thread,
  TurnDiffSummary,
} from "../../shared/desktop-contracts.js";

export type View = "home" | "thread" | "plugins" | "automations" | "debug" | "settings";

export type FeatureCard = {
  title: string;
  description: string;
  icon?: LucideIcon;
};
