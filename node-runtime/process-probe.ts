import { type ChildProcess, spawn } from 'node:child_process'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

export class ProcessProbeError extends Schema.TaggedError<ProcessProbeError>()(
  'ProcessProbeError',
  {
    executable: Schema.String,
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export type ProcessProbeResult = {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
}

function probeError(executable: string, cause: unknown) {
  return new ProcessProbeError({
    executable,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  })
}

function terminate(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null || child.killed) return
  try {
    child.kill('SIGTERM')
  } catch {
    // The process may have exited between the running check and termination.
  }
}

function collectOutput(
  executable: string,
  child: ChildProcess,
  input: { readonly stdin?: string | undefined; readonly maxOutputBytes?: number | undefined },
) {
  return Effect.callback<ProcessProbeResult, ProcessProbeError>((resume) => {
    let stdout = ''
    let stderr = ''
    let outputBytes = 0
    let settled = false
    const finish = (effect: Effect.Effect<ProcessProbeResult, ProcessProbeError>) => {
      if (settled) return
      settled = true
      resume(effect)
    }
    const onStdout = (chunk: string) => {
      stdout += chunk
      outputBytes += Buffer.byteLength(chunk)
      if (input.maxOutputBytes !== undefined && outputBytes > input.maxOutputBytes) {
        terminate(child)
        finish(Effect.fail(probeError(executable, new Error('Process produced too much output.'))))
      }
    }
    const onStderr = (chunk: string) => {
      stderr += chunk
      outputBytes += Buffer.byteLength(chunk)
      if (input.maxOutputBytes !== undefined && outputBytes > input.maxOutputBytes) {
        terminate(child)
        finish(Effect.fail(probeError(executable, new Error('Process produced too much output.'))))
      }
    }
    const onError = (error: Error) => finish(Effect.fail(probeError(executable, error)))
    const onStdinError = (error: Error) => finish(Effect.fail(probeError(executable, error)))
    const onClose = (exitCode: number | null) =>
      finish(Effect.succeed({ stdout, stderr, exitCode }))

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', onStdout)
    child.stderr?.on('data', onStderr)
    child.stdin?.once('error', onStdinError)
    child.once('error', onError)
    child.once('close', onClose)
    if (input.stdin !== undefined) child.stdin?.end(input.stdin)

    return Effect.sync(() => {
      settled = true
      child.stdout?.off('data', onStdout)
      child.stderr?.off('data', onStderr)
      child.stdin?.off('error', onStdinError)
      child.off('error', onError)
      child.off('close', onClose)
    })
  })
}

export function runProcessProbe(input: {
  readonly executable: string
  readonly args: readonly string[]
  readonly cwd?: string | undefined
  readonly env?: NodeJS.ProcessEnv | undefined
  readonly stdin?: string | undefined
  readonly maxOutputBytes?: number | undefined
  readonly timeout: number
  readonly timeoutMessage: string
}) {
  return Effect.scoped(
    Effect.acquireRelease(
      Effect.try({
        try: () =>
          spawn(input.executable, [...input.args], {
            cwd: input.cwd,
            env: input.env,
            stdio: [input.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
          }),
        catch: (error) => probeError(input.executable, error),
      }),
      (child) => Effect.sync(() => terminate(child)),
    ).pipe(
      Effect.flatMap((child) => collectOutput(input.executable, child, input)),
      Effect.timeoutOrElse({
        duration: input.timeout,
        orElse: () => Effect.fail(probeError(input.executable, new Error(input.timeoutMessage))),
      }),
    ),
  )
}
