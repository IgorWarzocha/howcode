import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

const require = createRequire(import.meta.url);

type PiThemeModule = {
  initTheme(themeName?: string, enableWatcher?: boolean): void;
  setRegisteredThemes(
    themes: AgentSession["resourceLoader"]["getThemes"] extends () => infer Result
      ? Result extends { themes: infer Themes }
        ? Themes
        : never
      : never,
  ): void;
};

let themeModulePromise: Promise<PiThemeModule> | null = null;

async function getPiThemeModule() {
  if (!themeModulePromise) {
    const piEntryPath = require.resolve("@mariozechner/pi-coding-agent");
    const themeModulePath = path.join(
      path.dirname(piEntryPath),
      "modes/interactive/theme/theme.js",
    );
    themeModulePromise = import(pathToFileURL(themeModulePath).href) as Promise<PiThemeModule>;
  }

  return themeModulePromise;
}

export async function applyHeadlessPiTheme(session: AgentSession) {
  const { initTheme, setRegisteredThemes } = await getPiThemeModule();
  setRegisteredThemes(session.resourceLoader.getThemes().themes);
  initTheme(session.settingsManager.getTheme(), false);
}
