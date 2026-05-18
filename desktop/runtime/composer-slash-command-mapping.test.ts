import { describe, expect, test } from 'vitest'
import { mapSessionCommands } from './composer-slash-command-mapping.ts'
import type { PiRuntime } from './types.ts'

function createSession(input: {
  commands?: Array<{ invocationName: string; description: string; sourceInfo?: unknown }>
  enableSkillCommands?: boolean
  promptTemplates?: Array<{ name: string; description: string; sourceInfo?: unknown }>
  skills?: Array<{ name: string; description: string; sourceInfo?: unknown }>
}): PiRuntime['session'] {
  return {
    extensionRunner: {
      getRegisteredCommands: () => input.commands ?? [],
    },
    promptTemplates: input.promptTemplates ?? [],
    resourceLoader: {
      getSkills: () => ({ skills: input.skills ?? [] }),
    },
    settingsManager: {
      getEnableSkillCommands: () => input.enableSkillCommands ?? false,
    },
  } as unknown as PiRuntime['session']
}

describe('mapSessionCommands', () => {
  test('includes app commands before extension, prompt, and skill commands', () => {
    const commands = mapSessionCommands(
      createSession({
        commands: [{ invocationName: 'review', description: 'Review code' }],
        enableSkillCommands: true,
        promptTemplates: [{ name: 'plan', description: 'Make a plan' }],
        skills: [{ name: 'hardening', description: 'Harden code' }],
      }),
    )

    expect(commands.map((command) => command.name)).toEqual([
      'settings',
      'new',
      'compact',
      'review',
      'plan',
      'skill:hardening',
    ])
  })

  test('keeps reserved and extension-owned names from being shadowed', () => {
    const commands = mapSessionCommands(
      createSession({
        commands: [
          { invocationName: 'settings', description: 'Reserved extension command' },
          { invocationName: 'deploy', description: 'Deploy extension command' },
        ],
        enableSkillCommands: true,
        promptTemplates: [
          { name: 'compact', description: 'Reserved prompt template' },
          { name: 'deploy', description: 'Shadowed prompt template' },
          { name: 'plan', description: 'Allowed prompt template' },
        ],
        skills: [
          { name: 'deploy', description: 'Allowed skill command' },
          { name: 'plan', description: 'Allowed skill command' },
        ],
      }),
    )

    expect(commands.map((command) => command.name)).toEqual([
      'settings',
      'new',
      'compact',
      'deploy',
      'plan',
      'skill:deploy',
      'skill:plan',
    ])
  })
})
