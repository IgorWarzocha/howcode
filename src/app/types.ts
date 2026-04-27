export type { ArchivedThread, Message, Project, Thread } from "../../shared/desktop-contracts.js";

export type View =
  | "inbox"
  | "code"
  | "thread"
  | "gitops"
  | "archived"
  | "chat"
  | "claw"
  | "work"
  | "settings"
  | "extensions"
  | "skills";
