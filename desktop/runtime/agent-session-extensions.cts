import type { AgentSession } from "@mariozechner/pi-coding-agent";

export async function bindHeadlessAgentSessionExtensions(session: AgentSession) {
  await session.bindExtensions({
    onError: (error) => {
      console.warn("Pi extension error", error);
    },
  });
}
