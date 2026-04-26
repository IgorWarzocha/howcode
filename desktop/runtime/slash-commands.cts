import type { ComposerSlashCommand, ComposerStateRequest } from "../../shared/desktop-contracts.ts";
import { getDesktopWorkingDirectory } from "../../shared/desktop-working-directory.ts";
import { appSettingsSlashCommand } from "../../shared/composer-slash-commands.ts";
import { getPersistedSessionPath } from "../../shared/session-paths.ts";
import { createComposerSnapshotSession } from "./composer-state.cts";
import {
  getCachedRuntimeForSessionPath,
  reloadRuntimeSettingsIfSafe,
  scheduleRuntimeDisposalForRuntime,
} from "./runtime-registry.cts";
import type { PiRuntime } from "./types.cts";

function mapSessionCommands(session: PiRuntime["session"]): ComposerSlashCommand[] {
  const commands: ComposerSlashCommand[] = [appSettingsSlashCommand];
  const extensionCommandNames = new Set<string>();

  for (const command of session.extensionRunner.getRegisteredCommands()) {
    extensionCommandNames.add(command.invocationName);
    commands.push({
      name: command.invocationName,
      description: command.description,
      source: "extension",
      sourceInfo: command.sourceInfo,
    });
  }

  for (const template of session.promptTemplates) {
    if (extensionCommandNames.has(template.name)) {
      continue;
    }

    commands.push({
      name: template.name,
      description: template.description,
      source: "prompt",
      sourceInfo: template.sourceInfo,
    });
  }

  if (session.settingsManager.getEnableSkillCommands()) {
    for (const skill of session.resourceLoader.getSkills().skills) {
      const skillCommandName = `skill:${skill.name}`;
      if (extensionCommandNames.has(skillCommandName)) {
        continue;
      }

      commands.push({
        name: skillCommandName,
        description: skill.description,
        source: "skill",
        sourceInfo: skill.sourceInfo,
      });
    }
  }

  return commands;
}

export async function getComposerSlashCommands(
  request: ComposerStateRequest = {},
): Promise<ComposerSlashCommand[]> {
  const persistedSessionPath = getPersistedSessionPath(request.sessionPath);
  const cachedRuntimePromise = persistedSessionPath
    ? getCachedRuntimeForSessionPath(persistedSessionPath)
    : null;

  if (cachedRuntimePromise && persistedSessionPath) {
    const runtime = await cachedRuntimePromise;
    if (!runtime.session.isStreaming) {
      await reloadRuntimeSettingsIfSafe(persistedSessionPath);
    }
    scheduleRuntimeDisposalForRuntime(runtime);
    return mapSessionCommands(runtime.session);
  }

  const snapshot = await createComposerSnapshotSession({
    projectId: request.projectId ?? getDesktopWorkingDirectory(),
    sessionPath: persistedSessionPath,
  });

  try {
    return mapSessionCommands(snapshot.session);
  } finally {
    snapshot.session.dispose();
  }
}
