import type { ComposerSlashCommand } from "./desktop-contracts";

const compactCommandPattern = /^\/compact(?:\s+([\s\S]*))?$/;

export function parseCompactSlashCommand(text: string) {
  const match = compactCommandPattern.exec(text.trim());
  if (!match) {
    return null;
  }

  return match[1]?.trim() ?? "";
}

export function isCompactSlashCommand(text: string) {
  return parseCompactSlashCommand(text) !== null;
}

export const appSettingsSlashCommand: ComposerSlashCommand = {
  name: "settings",
  description: "Open howcode app settings",
  source: "app",
};

export const compactSlashCommand: ComposerSlashCommand = {
  name: "compact",
  description: "Manually compact the session context",
  source: "builtin",
};

export const fallbackAppSlashCommands: ComposerSlashCommand[] = [
  appSettingsSlashCommand,
  compactSlashCommand,
];
