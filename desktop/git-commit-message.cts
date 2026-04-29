import type { ComposerStateRequest } from "../shared/desktop-contracts.ts";
import type { CommitMessageContext } from "./project-git.cts";
import { invokeRuntimeHost } from "./runtime-host/client-bridge.cts";

export function generateGitCommitMessage(
  request: ComposerStateRequest,
  context: CommitMessageContext,
) {
  return invokeRuntimeHost("generateGitCommitMessage", { request, context });
}
