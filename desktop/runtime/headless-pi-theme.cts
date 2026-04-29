import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

const piPackagePath = path.join("node_modules", "@mariozechner", "pi-coding-agent");

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

async function resolvePiPackageRootFromImport() {
  const entryUrl = await import.meta.resolve("@mariozechner/pi-coding-agent");
  const entryPath = fileURLToPath(entryUrl);
  return path.resolve(path.dirname(entryPath), "..");
}

function findPiPackageRoot() {
  let directory = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidate = path.join(directory, piPackagePath);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error("Could not locate @mariozechner/pi-coding-agent package root.");
    }
    directory = parent;
  }
}

async function getPiThemeModule() {
  if (!themeModulePromise) {
    const piPackageRoot = await resolvePiPackageRootFromImport().catch(() => findPiPackageRoot());
    const themeModulePath = path.join(piPackageRoot, "dist", "modes/interactive/theme/theme.js");
    themeModulePromise = import(pathToFileURL(themeModulePath).href) as Promise<PiThemeModule>;
  }

  return themeModulePromise;
}

export async function applyHeadlessPiTheme(session: AgentSession) {
  const { initTheme, setRegisteredThemes } = await getPiThemeModule();
  setRegisteredThemes(session.resourceLoader.getThemes().themes);
  initTheme(session.settingsManager.getTheme(), false);
}
