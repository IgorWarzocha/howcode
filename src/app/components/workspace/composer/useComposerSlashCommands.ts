import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { appSettingsSlashCommand } from "../../../../../shared/composer-slash-commands";
import type { ComposerSlashCommand } from "../../../desktop/types";
import { getComposerSlashCommandsQuery } from "../../../query/desktop-query";

export const slashCommandSourceLabels: Record<ComposerSlashCommand["source"], string> = {
  app: "App",
  extension: "Extensions",
  prompt: "Prompts",
  skill: "Skills",
};

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

type UseComposerSlashCommandsOptions = {
  draft: string;
  projectId: string;
  sessionPath: string | null;
  setDraft: (draft: string) => void;
  send: () => void;
  onOpenSettingsView: () => void;
};

export function useComposerSlashCommands({
  draft,
  projectId,
  sessionPath,
  setDraft,
  send,
  onOpenSettingsView,
}: UseComposerSlashCommandsOptions) {
  const [commands, setCommands] = useState<ComposerSlashCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissedDraft, setDismissedDraft] = useState<string | null>(null);
  const candidateFilter = getSlashCommandFilter(draft);
  const filter = draft === dismissedDraft ? null : candidateFilter;
  const open = filter !== null;
  const filteredCommands = useMemo(() => {
    if (filter === null) {
      return [];
    }

    return commands.filter((command) => {
      const haystack = `${command.name} ${command.description ?? ""}`.toLowerCase();
      return haystack.includes(filter);
    });
  }, [commands, filter]);

  const selectCommand = (command: ComposerSlashCommand) => {
    if (command.source === "app" && command.name === "settings") {
      setDraft("");
      onOpenSettingsView();
      return;
    }

    setDraft(`/${command.name} `);
  };

  const submit = () => {
    if (open) {
      const selectedCommand = filteredCommands[selectedIndex];
      if (selectedCommand) {
        selectCommand(selectedCommand);
        return;
      }

      if (loading && draft.trim() !== "/settings") {
        return;
      }
    }

    // Keep this exact-match only: selected Pi commands named "settings" intentionally insert
    // "/settings " so they can still be sent through AgentSession.prompt().
    if (draft === "/settings") {
      selectCommand(appSettingsSlashCommand);
      return;
    }

    send();
  };

  const dismiss = () => {
    setDismissedDraft(draft);
    setCommands([]);
    setLoading(false);
    setSelectedIndex(0);
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

    if (event.key === "Enter" && !event.shiftKey && loading) {
      event.preventDefault();
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (!open) {
      setSelectedIndex(0);
      setCommands([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setCommands([]);
    setSelectedIndex(0);
    setLoading(true);
    void getComposerSlashCommandsQuery({ projectId, sessionPath })
      .then((nextCommands) => {
        if (!cancelled) {
          setCommands(nextCommands);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommands([appSettingsSlashCommand]);
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
  }, [open, projectId, sessionPath]);

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
    selectCommand,
    selectedIndex,
    setSelectedIndex,
    submit,
  };
}
