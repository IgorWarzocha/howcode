import type { LucideIcon } from "lucide-react";

export type View = "home" | "thread" | "plugins" | "automations" | "debug";

export type Thread = {
  id: string;
  title: string;
  age: string;
  sessionPath?: string;
  summary?: string;
  pinned?: boolean;
};

export type Project = {
  id: string;
  name: string;
  subtitle?: string;
  threads: Thread[];
  collapsed?: boolean;
};

export type Message = {
  id: string;
  role: "assistant" | "user";
  format?: "prose" | "list";
  content: string[];
};

export type FeatureCard = {
  title: string;
  description: string;
  icon?: LucideIcon;
};
