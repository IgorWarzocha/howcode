import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { PiRuntime } from "../runtime/types.cts";

export type RuntimeToolProgress = {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  partialResult?: { content?: unknown };
  isError?: boolean;
  terminal?: boolean;
};

const liveToolProgressByRuntime = new WeakMap<PiRuntime, Map<string, RuntimeToolProgress>>();

function getLiveToolProgress(runtime: PiRuntime) {
  let progress = liveToolProgressByRuntime.get(runtime);
  if (!progress) {
    progress = new Map();
    liveToolProgressByRuntime.set(runtime, progress);
  }
  return progress;
}

function hasDisplayableToolContent(content: unknown): content is string | unknown[] {
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some((part) => {
    if (typeof part === "string") return part.trim().length > 0;
    if (!part || typeof part !== "object") return false;
    const record = part as Record<string, unknown>;
    if (record.type === "image") return true;
    return typeof record.text === "string" && record.text.trim().length > 0;
  });
}

export function getLiveToolProgressMessages(runtime: PiRuntime) {
  const progress = liveToolProgressByRuntime.get(runtime);
  if (!progress || progress.size === 0) return [] as AgentMessage[];
  return [...progress.values()].map((entry) => {
    const content = entry.partialResult?.content;
    const displayContent = hasDisplayableToolContent(content)
      ? content
      : [
          {
            type: "text",
            text: entry.terminal
              ? entry.isError
                ? `${entry.toolName} failed.`
                : `${entry.toolName} finished.`
              : `Running ${entry.toolName}...`,
          },
        ];
    return {
      role: "toolResult",
      toolName: entry.toolName,
      isError: Boolean(entry.isError),
      content: displayContent,
      timestamp: `tool-progress:${entry.toolCallId}`,
    } as unknown as AgentMessage;
  });
}

export function rememberRuntimeToolProgress(runtime: PiRuntime, entry: RuntimeToolProgress) {
  getLiveToolProgress(runtime).set(entry.toolCallId, entry);
}

export function clearRuntimeToolProgress(
  runtime: PiRuntime,
  options: { toolCallId?: string; toolName?: string } = {},
) {
  const progress = liveToolProgressByRuntime.get(runtime);
  if (!progress) return;
  if (options.toolCallId) progress.delete(options.toolCallId);
  else if (!options.toolName) progress.clear();
  else {
    for (const [toolCallId, entry] of progress) {
      if (entry.toolName === options.toolName) {
        progress.delete(toolCallId);
        break;
      }
    }
  }
  if (progress.size === 0) liveToolProgressByRuntime.delete(runtime);
}
