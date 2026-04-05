import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type { DesktopEvent } from "../../shared/desktop-contracts.ts";

export type PiRuntime = {
  cwd: string;
  session: AgentSession;
  pendingTurnCount: number | null;
};

export type RuntimeThreadReason = Extract<DesktopEvent, { type: "thread-update" }>["reason"];
