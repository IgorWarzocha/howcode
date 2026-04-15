export function mergeDraftWithRestoredQueuedPrompt(
  currentDraft: string,
  restoredQueuedPrompt: string,
) {
  const currentText = currentDraft.trim();
  const restoredText = restoredQueuedPrompt.trim();

  if (!restoredText) {
    return currentDraft;
  }

  if (!currentText) {
    return restoredQueuedPrompt;
  }

  if (currentText === restoredText) {
    return currentDraft;
  }

  return `${currentDraft.replace(/\s+$/u, "")}\n\n${restoredQueuedPrompt}`;
}
