import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ThreadData, TurnDiffSummary } from "./desktop-contracts";
import { getFirstUserTurnTitle, mapAgentMessagesToUiMessages } from "./pi-message-mapper";

type BuildThreadDataInput = {
  sessionPath: string;
  sourceMessages: readonly AgentMessage[];
  previousMessageCount: number;
  isStreaming: boolean;
  turnDiffSummaries: TurnDiffSummary[];
};

export function buildThreadData({
  sessionPath,
  sourceMessages,
  previousMessageCount,
  isStreaming,
  turnDiffSummaries,
}: BuildThreadDataInput): ThreadData {
  const messages = mapAgentMessagesToUiMessages([...sourceMessages]);

  return {
    sessionPath,
    title: getFirstUserTurnTitle(messages),
    messages,
    previousMessageCount,
    isStreaming,
    turnDiffSummaries,
  };
}
