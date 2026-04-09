import type { LucideIcon } from "lucide-react";

export type {
  ArchivedThread,
  Message,
  Project,
  Thread,
  TurnDiffSummary,
} from "../../shared/desktop-contracts.js";

export type View =
  | "code"
  | "thread"
  | "chat"
  | "claw"
  | "work"
  | "settings"
  | "extensions"
  | "skills";

export type FeatureCard = {
  title: string;
  description: string;
  icon?: LucideIcon;
};
