import type { LucideIcon } from "lucide-react";

export type { ArchivedThread, Message, Project, Thread } from "../../shared/desktop-contracts.js";

export type View =
  | "inbox"
  | "code"
  | "thread"
  | "gitops"
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
