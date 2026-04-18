import path from "node:path";
import { pathToFileURL } from "node:url";
import { app } from "electron";
import type {
  DesktopRuntimeModules,
  PiSkillsModule,
  PiThreadsModule,
  SkillCreatorModule,
  TerminalManagerModule,
} from "./desktop-runtime-contracts";

function getDesktopBuildDirectory() {
  return path.join(app.getAppPath(), "build", "desktop");
}

async function importDesktopModule<TModule>(fileName: string) {
  const modulePath = path.join(getDesktopBuildDirectory(), fileName);
  return (await import(pathToFileURL(modulePath).href)) as TModule;
}

export async function loadDesktopRuntimeModules(): Promise<DesktopRuntimeModules> {
  const [piThreads, piSkills, skillCreator, terminalManager] = await Promise.all([
    importDesktopModule<PiThreadsModule>("pi-threads.mjs"),
    importDesktopModule<PiSkillsModule>("pi-skills.mjs"),
    importDesktopModule<SkillCreatorModule>("skill-creator-session.mjs"),
    importDesktopModule<TerminalManagerModule>("terminal-manager.mjs"),
  ]);

  return {
    piThreads,
    piSkills,
    skillCreator,
    terminalManager,
  };
}
