import type {
  ComposerQueuedPrompt,
  ComposerStreamingBehavior,
} from "../../shared/desktop-contracts.ts";

export type ComposerQueueSession = {
  followUp: (text: string) => Promise<void>;
  steer: (text: string) => Promise<void>;
};

type ComposerQueueMode = Exclude<ComposerStreamingBehavior, "stop">;

function buildQueuedPromptId(mode: ComposerQueueMode, text: string, duplicateIndex: number) {
  return `${mode}:${duplicateIndex}:${text}`;
}

function buildQueuedPromptsForMode(
  mode: ComposerQueueMode,
  prompts: string[],
): ComposerQueuedPrompt[] {
  const duplicateCounts = new Map<string, number>();

  return prompts.map((text, queueIndex) => {
    const duplicateIndex = duplicateCounts.get(text) ?? 0;
    duplicateCounts.set(text, duplicateIndex + 1);

    return {
      id: buildQueuedPromptId(mode, text, duplicateIndex),
      mode,
      queueIndex,
      text,
    };
  });
}

export function buildQueuedPrompts(queue: { steering: string[]; followUp: string[] }) {
  return [
    ...buildQueuedPromptsForMode("steer", queue.steering),
    ...buildQueuedPromptsForMode("followUp", queue.followUp),
  ];
}

export function findQueuedPromptIndexById(
  mode: ComposerQueueMode,
  prompts: string[],
  queueId: string,
) {
  return (
    buildQueuedPromptsForMode(mode, prompts).find((prompt) => prompt.id === queueId)?.queueIndex ??
    null
  );
}

export async function replayComposerQueue(
  session: ComposerQueueSession,
  queue: { steering: string[]; followUp: string[] },
) {
  for (const queuedText of queue.steering) {
    await session.steer(queuedText);
  }

  for (const queuedText of queue.followUp) {
    await session.followUp(queuedText);
  }
}
