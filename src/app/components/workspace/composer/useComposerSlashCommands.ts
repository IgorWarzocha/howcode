import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  appSettingsSlashCommand,
  fallbackAppSlashCommands,
} from "../../../../../shared/composer-slash-commands";
import type { ComposerSlashCommand } from "../../../desktop/types";
import { getComposerSlashCommandsQuery } from "../../../query/desktop-query";

const slashCommandSourceOrder: Record<ComposerSlashCommand["source"], number> = {
  prompt: 0,
  app: 1,
  builtin: 1,
  skill: 2,
  extension: 3,
};

const slashCommandSourceLabels: Record<ComposerSlashCommand["source"], string> = {
  app: "System",
  builtin: "System",
  extension: "Extensions",
  prompt: "Prompts",
  skill: "Skills",
};

export function getComposerSlashCommandGroupLabel(command: ComposerSlashCommand) {
  return slashCommandSourceLabels[command.source];
}

export const composerSlashCommandListboxId = "composer-slash-command-listbox";

export function getComposerSlashCommandOptionId(index: number) {
  return `composer-slash-command-${index}`;
}

function getSlashCommandFilter(draft: string) {
  if (!draft.startsWith("/")) {
    return null;
  }

  const query = draft.slice(1);
  if (/\s/.test(query)) {
    return null;
  }

  return query.toLowerCase();
}

function shouldWaitForSlashCommands(draft: string) {
  const trimmedDraft = draft.trim();
  return (
    trimmedDraft.startsWith("/") && !trimmedDraft.includes(" ") && trimmedDraft !== "/settings"
  );
}

type UseComposerSlashCommandsOptions = {
  draft: string;
  projectId: string;
  sessionPath: string | null;
  composerMode?: "chat" | "code";
  setDraft: (draft: string) => void;
  send: () => void;
  sendExtensionCommand?: () => void;
  onOpenSettingsView: () => void;
};

export type ComposerSlashCommands = ReturnType<typeof useComposerSlashCommands>;

export function useComposerSlashCommands({
  draft,
  projectId,
  sessionPath,
  composerMode = "code",
  setDraft,
  send,
  sendExtensionCommand,
  onOpenSettingsView,
}: UseComposerSlashCommandsOptions) {
  const [commands, setCommands] = useState<ComposerSlashCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null);
  const candidateFilter = getSlashCommandFilter(draft);
  const filter = draft === dismissedDraft ? null : candidateFilter;
  const open = filter !== null;
  const commandScopeKey = `${projectId}\0${sessionPath ?? ""}\0${composerMode}`;
  const draftRef = useRef(draft);
  const commandScopeKeyRef = useRef(commandScopeKey);
  draftRef.current = draft;
  commandScopeKeyRef.current = commandScopeKey;
  const filteredCommands = useMemo(() => {
    if (filter === null) {
      return [];
    }

    return commands
      .filter((command) => command.name.toLowerCase().includes(filter))
      .sort((left, right) => {
        const sourceOrder =
          slashCommandSourceOrder[left.source] - slashCommandSourceOrder[right.source];
        if (sourceOrder !== 0) {
          return sourceOrder;
        }

        return left.name.localeCompare(right.name);
      });
  }, [commands, filter]);

  const isExactCommandDraft = (command: ComposerSlashCommand) =>
    draft.trim() === `/${command.name}` && !draft.endsWith(" ");

  const getDraftCommand = () => {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft.startsWith("/")) return null;
    const commandName = trimmedDraft.slice(1).split(/\s+/, 1)[0];
    return commands.find((command) => command.name === commandName) ?? null;
  };

  const selectCommand = (command: ComposerSlashCommand) => {
    if (command.source === "app" && command.name === "settings") {
      setDraft("");
      onOpenSettingsView();
      return;
    }

    if (isExactCommandDraft(command)) {
      dismiss();
      if (command.source === "extension" && sendExtensionCommand) {
        sendExtensionCommand();
      } else {
        send();
      }
      return;
    }

    setDraft(`/${command.name} `);
  };

  const completeCommand = (command: ComposerSlashCommand) => {
    setDraft(`/${command.name} `);
  };

  const submit = () => {
    if (open) {
      const selectedCommand = filteredCommands[selectedIndex];
      if (selectedCommand) {
        selectCommand(selectedCommand);
        return;
      }

      if (loading && shouldWaitForSlashCommands(draft)) {
        return;
      }
    }

    // Keep this exact-match only: selected Pi commands named "settings" intentionally insert
    // "/settings " so they can still be sent through AgentSession.prompt().
    if (draft === "/settings") {
      selectCommand(appSettingsSlashCommand);
      return;
    }

    if (draft.trim().startsWith("/")) {
      const draftCommand = getDraftCommand();
      dismiss();
      if (draftCommand?.source === "extension" && sendExtensionCommand) {
        sendExtensionCommand();
        return;
      }
      if (!draftCommand && sendExtensionCommand && (loading || commands.length === 0)) {
        const submittedDraft = draft;
        const submittedScopeKey = commandScopeKey;
        void getComposerSlashCommandsQuery({ projectId, sessionPath, composerMode })
          .then((nextCommands) => {
            if (
              draftRef.current !== submittedDraft ||
              commandScopeKeyRef.current !== submittedScopeKey
            ) {
              return;
            }
            const commandName = submittedDraft.trim().slice(1).split(/\s+/, 1)[0];
            const resolvedCommand = nextCommands.find((command) => command.name === commandName);
            if (resolvedCommand?.source === "extension") {
              sendExtensionCommand();
            } else if (resolvedCommand) {
              send();
            }
          })
          .catch(() => {
            // Keep slash text in the editor rather than leaking an unresolved command to the model.
          });
        return;
      }
    }

    send();
  };

  const dismiss = (options?: { clearDraft?: boolean }) => {
    setDismissedDraft(draft);
    setCommands([]);
    setLoading(false);
    setSelectedIndex(0);
    if (options?.clearDraft) {
      setDraft("");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) {
      return false;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return true;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) =>
        Math.min(current + 1, Math.max(0, filteredCommands.length - 1)),
      );
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(0, current - 1));
      return true;
    }

    if (event.key === "Tab" && !event.shiftKey && filteredCommands[selectedIndex]) {
      event.preventDefault();
      completeCommand(filteredCommands[selectedIndex]);
      return true;
    }

    if (event.key === "Enter" && !event.shiftKey && filteredCommands[selectedIndex]) {
      event.preventDefault();
      selectCommand(filteredCommands[selectedIndex]);
      return true;
    }

    if (event.key === "Enter" && !event.shiftKey && draft === "/settings") {
      event.preventDefault();
      submit();
      return true;
    }

    if (event.key === "Enter" && !event.shiftKey && loading && shouldWaitForSlashCommands(draft)) {
      event.preventDefault();
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (!open) {
      setSelectedIndex(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setCommands([]);
    setSelectedIndex(0);
    setLoading(true);
    void getComposerSlashCommandsQuery({ projectId, sessionPath, composerMode })
      .then((nextCommands) => {
        if (!cancelled) {
          setCommands(nextCommands);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommands(fallbackAppSlashCommands);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [composerMode, open, projectId, sessionPath]);

  useEffect(() => {
    void commandScopeKey;
    setCommands([]);
  }, [commandScopeKey]);

  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  useEffect(() => {
    if (dismissedDraft !== null && draft !== dismissedDraft) {
      setDismissedDraft(null);
    }
  }, [dismissedDraft, draft]);

  return {
    activeDescendantId: open
      ? filteredCommands[selectedIndex]
        ? getComposerSlashCommandOptionId(selectedIndex)
        : undefined
      : undefined,
    commands: filteredCommands,
    handleKeyDown,
    listboxId: composerSlashCommandListboxId,
    loading,
    open,
    dismiss,
    selectCommand,
    selectedIndex,
    setSelectedIndex,
    submit,
  };
}
