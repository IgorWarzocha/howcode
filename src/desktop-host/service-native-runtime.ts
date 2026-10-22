import { runProcessProbe } from '@howaboua/howcode-sdk/node/process-probe'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import { satisfies } from 'semver'
import serviceNativeAbi from '../../shared/service-native-abi.json'

const NodeRuntimeProbe = Schema.Struct({
  version: Schema.String,
  abi: Schema.String,
})
export interface NodeRuntimeProbe extends Schema.Schema.Type<typeof NodeRuntimeProbe> {}

function rejectNodeProbeExit(nodeExecutable: string, stderr: string, code: number | null) {
  return new Error(
    `Failed to probe Node runtime ${nodeExecutable} (exit ${code ?? 'unknown'}): ${stderr.trim()}`,
  )
}

export async function probeNodeRuntime(nodeExecutable: string): Promise<NodeRuntimeProbe> {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const result = yield* runProcessProbe({
        executable: nodeExecutable,
        args: ['-p', 'JSON.stringify({version: process.version, abi: process.versions.modules})'],
        timeout: 3_000,
        timeoutMessage: `Timed out probing Node runtime: ${nodeExecutable}`,
      })
      if (result.exitCode !== 0)
        return yield* Effect.fail(
          rejectNodeProbeExit(nodeExecutable, result.stderr, result.exitCode),
        )
      const parsed = yield* Effect.try({
        try: () => JSON.parse(result.stdout.trim()),
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      })
      return yield* Schema.decodeUnknownEffect(NodeRuntimeProbe)(parsed)
    }),
  )
}

export async function prepareServiceNativeRuntime(input: { nodeExecutable: string }) {
  const runtime = await probeNodeRuntime(input.nodeExecutable)
  if (
    !(
      runtime.abi === serviceNativeAbi.nodeAbi &&
      satisfies(runtime.version, serviceNativeAbi.nodeVersionRange)
    )
  ) {
    throw new Error(
      `Howcode desktop service requires Node ${serviceNativeAbi.nodeVersionRange} (ABI ${serviceNativeAbi.nodeAbi}). ${input.nodeExecutable} is ${runtime.version} ABI ${runtime.abi}.`,
    )
  }

  return runtime
}
