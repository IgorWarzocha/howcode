import type { LucideIcon } from "lucide-react";

export type { Message, Project, Thread } from "../../shared/desktop-contracts.js";

export type View = "home" | "thread" | "plugins" | "automations" | "debug";

export type FeatureCard = {
  title: string;
  description: string;
  icon?: LucideIcon;
};
