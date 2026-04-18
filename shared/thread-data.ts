import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ThreadData } from "./desktop-contracts";
import { getFirstUserTurnTitle, mapAgentMessagesToUiMessages } from "./pi-message-mapper";

type BuildThreadDataInput = {
  sessionPath: string;
  sourceMessages: readonly AgentMessage[];
  previousMessageCount: number;
  isStreaming: boolean;
};

export function buildThreadData({
  sessionPath,
  sourceMessages,
  previousMessageCount,
  isStreaming,
}: BuildThreadDataInput): ThreadData {
  const messages = mapAgentMessagesToUiMessages([...sourceMessages]);

  return {
    sessionPath,
    title: getFirstUserTurnTitle(messages),
    messages,
    previousMessageCount,
    isStreaming,
  };
}

export function setThreadStreamingState(thread: ThreadData, isStreaming: boolean): ThreadData {
  return thread.isStreaming === isStreaming ? thread : { ...thread, isStreaming };
}
