import {
  appNewSessionSlashCommand,
  appSettingsSlashCommand,
  compactSlashCommand,
} from '../../shared/composer-slash-commands.ts'
import type { ComposerSlashCommand } from '../../shared/desktop-contracts.ts'
import type { PiRuntime } from '../runtime/types.ts'

const reservedCommandNames = new Set([
  appSettingsSlashCommand.name,
  appNewSessionSlashCommand.name,
  compactSlashCommand.name,
])

export function mapSessionCommands(session: PiRuntime['session']): ComposerSlashCommand[] {
  const commands: ComposerSlashCommand[] = [
    appSettingsSlashCommand,
    appNewSessionSlashCommand,
    compactSlashCommand,
  ]
  const extensionCommandNames = new Set<string>()

  for (const command of session.extensionRunner.getRegisteredCommands()) {
    if (reservedCommandNames.has(command.invocationName)) {
      continue
    }

    extensionCommandNames.add(command.invocationName)
    commands.push({
      name: command.invocationName,
      description: command.description,
      source: 'extension',
      sourceInfo: command.sourceInfo,
    })
  }

  for (const template of session.promptTemplates) {
    if (reservedCommandNames.has(template.name) || extensionCommandNames.has(template.name)) {
      continue
    }

    commands.push({
      name: template.name,
      description: template.description,
      source: 'prompt',
      sourceInfo: template.sourceInfo,
    })
  }

  if (session.settingsManager.getEnableSkillCommands()) {
    for (const skill of session.resourceLoader.getSkills().skills) {
      const skillCommandName = `skill:${skill.name}`
      if (
        reservedCommandNames.has(skillCommandName) ||
        extensionCommandNames.has(skillCommandName)
      ) {
        continue
      }

      commands.push({
        name: skillCommandName,
        description: skill.description,
        source: 'skill',
        sourceInfo: skill.sourceInfo,
      })
    }
  }

  return commands
}
