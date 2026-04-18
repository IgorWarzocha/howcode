import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  DesktopRuntimeModules,
  PiSkillsModule,
  PiThreadsModule,
  SkillCreatorModule,
  TerminalManagerModule,
} from "./desktop-runtime-contracts";
import { getDesktopBuildDirectory } from "./app-paths";

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
