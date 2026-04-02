import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type { DesktopEvent } from "../../shared/desktop-contracts.js";

export type PiRuntime = {
  cwd: string;
  session: AgentSession;
};

export type RuntimeThreadReason = Extract<DesktopEvent, { type: "thread-update" }>["reason"];
