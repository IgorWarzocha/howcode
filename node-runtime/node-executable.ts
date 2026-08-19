import { accessSync, constants, statSync } from 'node:fs'
import path from 'node:path'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { runProcessProbe } from './process-probe'

export function isExecutableFile(filePath: string) {
  try {
    if (!statSync(filePath).isFile()) return false
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function resolveCandidate(candidate: string | undefined, requireAbsolute: boolean) {
  const normalized = candidate?.trim()
  return normalized &&
    (!requireAbsolute || path.isAbsolute(normalized)) &&
    isExecutableFile(normalized)
    ? normalized
    : null
}

function probeShell(
  shell: string,
  input: {
    readonly requireAbsoluteShellPath: boolean
    readonly shellFlags: (shellName: string) => readonly string[]
  },
) {
  return runProcessProbe({
    executable: shell,
    args: [...input.shellFlags(path.basename(shell)), 'command -v node'],
    timeout: 2_000,
    timeoutMessage: `Timed out discovering Node through ${shell}`,
  }).pipe(
    Effect.option,
    Effect.map((result) =>
      Option.isSome(result)
        ? resolveCandidate(
            result.value.stdout.trim().split('\n')[0],
            input.requireAbsoluteShellPath,
          )
        : null,
    ),
  )
}

export function discoverNodeExecutable(input: {
  readonly environmentCandidates: readonly (string | undefined)[]
  readonly requireAbsoluteEnvironmentPath: boolean
  readonly requireAbsoluteShellPath: boolean
  readonly shellFlags: (shellName: string) => readonly string[]
  readonly shells: readonly (string | undefined)[]
}) {
  return Effect.gen(function* () {
    for (const candidate of input.environmentCandidates) {
      const resolved = resolveCandidate(candidate, input.requireAbsoluteEnvironmentPath)
      if (resolved) return resolved
    }

    for (const shell of [
      ...new Set(input.shells.filter((value): value is string => Boolean(value))),
    ]) {
      if (!isExecutableFile(shell)) continue
      const candidate = yield* probeShell(shell, input)
      if (candidate) return candidate
    }

    return null
  })
}
