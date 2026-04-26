import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ThreadData } from "./desktop-contracts";
import { getFirstUserTurnTitle, mapAgentMessagesToUiMessages } from "./pi-message-mapper";

type BuildThreadDataInput = {
  sessionPath: string;
  sourceMessages: readonly AgentMessage[];
  previousMessageCount: number;
  isStreaming: boolean;
  isCompacting?: boolean;
};

export function buildThreadData({
  sessionPath,
  sourceMessages,
  previousMessageCount,
  isStreaming,
  isCompacting = false,
}: BuildThreadDataInput): ThreadData {
  const messages = mapAgentMessagesToUiMessages([...sourceMessages]);

  return {
    sessionPath,
    title: getFirstUserTurnTitle(messages),
    messages,
    previousMessageCount,
    isStreaming,
    isCompacting,
  };
}

export function setThreadStreamingState(thread: ThreadData, isStreaming: boolean): ThreadData {
  return thread.isStreaming === isStreaming ? thread : { ...thread, isStreaming };
}

export function setThreadCompactingState(thread: ThreadData, isCompacting: boolean): ThreadData {
  return thread.isCompacting === isCompacting ? thread : { ...thread, isCompacting };
}
