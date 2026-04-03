import { createHash } from "node:crypto";
import type { TerminalOpenRequest } from "../../shared/terminal-contracts";

export function makeSessionId(request: TerminalOpenRequest) {
  const sessionKey = JSON.stringify({
    projectId: request.projectId,
    sessionPath: request.sessionPath ?? null,
    cwd: request.cwd ?? request.projectId,
    launchMode: request.launchMode ?? "shell",
  });

  return `term_${createHash("sha256").update(sessionKey).digest("hex").slice(0, 24)}`;
}
