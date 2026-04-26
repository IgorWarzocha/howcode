import type { ComposerSlashCommand } from "./desktop-contracts";

export const appSettingsSlashCommand: ComposerSlashCommand = {
  name: "settings",
  description: "Open howcode app settings",
  source: "app",
};

export const fallbackAppSlashCommands: ComposerSlashCommand[] = [appSettingsSlashCommand];
