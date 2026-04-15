export type ComposerQueueSession = {
  followUp: (text: string) => Promise<void>;
  steer: (text: string) => Promise<void>;
};

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
