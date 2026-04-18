export async function withComposerSendLock<T>(
  lock: { current: boolean },
  task: () => Promise<T>,
): Promise<T | undefined> {
  if (lock.current) {
    return undefined;
  }

  lock.current = true;

  try {
    return await task();
  } finally {
    lock.current = false;
  }
}
