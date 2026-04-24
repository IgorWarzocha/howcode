import { useMemo, useRef, useState } from "react";
import type { AppShellController } from "../../app-shell/useAppShellController";
import type { ComposerQueuedPrompt } from "../../desktop/types";

type RestoredQueuedPromptState = {
  projectId: string;
  sessionPath: string | null;
  text: string;
};

export function useQueuedPromptRestore({
  composerProjectId,
  handleAction,
  terminalSessionPath,
}: {
  composerProjectId: string;
  handleAction: AppShellController["handleAction"];
  terminalSessionPath: string | null;
}) {
  const [restoredQueuedPrompt, setRestoredQueuedPrompt] =
    useState<RestoredQueuedPromptState | null>(null);
  const [pendingQueuedPromptIds, setPendingQueuedPromptIds] = useState<string[]>([]);
  const pendingQueuedPromptIdsRef = useRef(new Set<string>());
  const pendingQueueScopeKey = `${composerProjectId}:${terminalSessionPath ?? ""}`;
  const pendingQueueScopePrefix = `${pendingQueueScopeKey}:`;
  const pendingQueuedPromptIdsForSession = useMemo(
    () =>
      pendingQueuedPromptIds.flatMap((pendingKey) =>
        pendingKey.startsWith(pendingQueueScopePrefix)
          ? [pendingKey.slice(pendingQueueScopePrefix.length)]
          : [],
      ),
    [pendingQueueScopePrefix, pendingQueuedPromptIds],
  );

  const scopedRestoredQueuedPrompt =
    restoredQueuedPrompt?.projectId === composerProjectId &&
    restoredQueuedPrompt.sessionPath === terminalSessionPath
      ? restoredQueuedPrompt.text
      : null;

  const dequeuePrompt = async (prompt: ComposerQueuedPrompt) => {
    const result = await handleAction("composer.dequeue", {
      projectId: composerProjectId,
      sessionPath: terminalSessionPath,
      queueId: prompt.id,
      queueSnapshotKey: prompt.queueSnapshotKey,
      queueMode: prompt.mode,
    });

    return typeof result?.result?.dequeuedText === "string" ? result.result.dequeuedText : null;
  };

  const runPendingPromptMutation = async (
    prompt: ComposerQueuedPrompt,
    mutate: () => Promise<void>,
  ) => {
    const pendingKey = `${pendingQueueScopeKey}:${prompt.id}`;

    if (pendingQueuedPromptIdsRef.current.has(pendingKey)) {
      return;
    }

    pendingQueuedPromptIdsRef.current.add(pendingKey);
    setPendingQueuedPromptIds((current) => [...current, pendingKey]);

    try {
      await mutate();
    } finally {
      pendingQueuedPromptIdsRef.current.delete(pendingKey);
      setPendingQueuedPromptIds((current) => current.filter((id) => id !== pendingKey));
    }
  };

  const handleEditQueuedPrompt = (prompt: ComposerQueuedPrompt) =>
    runPendingPromptMutation(prompt, async () => {
      const dequeuedText = await dequeuePrompt(prompt);
      if (dequeuedText !== null) {
        setRestoredQueuedPrompt({
          projectId: composerProjectId,
          sessionPath: terminalSessionPath,
          text: dequeuedText,
        });
      }
    });

  const handleRemoveQueuedPrompt = (prompt: ComposerQueuedPrompt) =>
    runPendingPromptMutation(prompt, async () => {
      await dequeuePrompt(prompt);
    });

  const markRestoredQueuedPromptApplied = () => {
    setRestoredQueuedPrompt((current) =>
      current?.projectId === composerProjectId && current.sessionPath === terminalSessionPath
        ? null
        : current,
    );
  };

  return {
    handleEditQueuedPrompt,
    handleRemoveQueuedPrompt,
    markRestoredQueuedPromptApplied,
    pendingQueuedPromptIdsForSession,
    scopedRestoredQueuedPrompt,
  };
}
