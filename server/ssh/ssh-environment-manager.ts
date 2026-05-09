import { Data, Effect } from 'effect'
import type {
  SshHowcodeEnvironmentConfig,
  SshHowcodeEnvironmentConnection,
} from '../ssh-howcode-environments'
import {
  disconnectSshHowcodeServer,
  ensureSshHowcodeServer as ensureLegacySshHowcodeServer,
} from '../ssh-howcode-environments'

export class SshEnvironmentError extends Data.TaggedError('SshEnvironmentError')<{
  message: string
  cause?: unknown
}> {}

export type SshHowcodeEnvironmentManager = {
  ensureEnvironment: (
    config: SshHowcodeEnvironmentConfig,
  ) => Effect.Effect<SshHowcodeEnvironmentConnection, SshEnvironmentError>
  disconnectEnvironment: (
    config: SshHowcodeEnvironmentConfig,
  ) => Effect.Effect<void, SshEnvironmentError>
}

export const sshHowcodeEnvironmentManager: SshHowcodeEnvironmentManager = {
  ensureEnvironment: (config) =>
    Effect.tryPromise({
      try: () => ensureLegacySshHowcodeServer(config),
      catch: (cause) =>
        new SshEnvironmentError({
          message: cause instanceof Error ? cause.message : 'Failed to ensure SSH Howcode server.',
          cause,
        }),
    }),
  disconnectEnvironment: (config) =>
    Effect.try({
      try: () => disconnectSshHowcodeServer(config),
      catch: (cause) =>
        new SshEnvironmentError({
          message:
            cause instanceof Error ? cause.message : 'Failed to disconnect SSH Howcode server.',
          cause,
        }),
    }),
}

export function ensureSshHowcodeEnvironment(
  config: SshHowcodeEnvironmentConfig,
): Effect.Effect<SshHowcodeEnvironmentConnection, SshEnvironmentError> {
  return sshHowcodeEnvironmentManager.ensureEnvironment(config)
}

export async function ensureSshHowcodeEnvironmentPromise(
  config: SshHowcodeEnvironmentConfig,
): Promise<SshHowcodeEnvironmentConnection> {
  return await Effect.runPromise(ensureSshHowcodeEnvironment(config))
}
