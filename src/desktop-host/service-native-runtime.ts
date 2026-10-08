import { runProcessProbe } from '@howaboua/howcode-sdk/node/process-probe'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import serviceNativeAbi from '../../shared/service-native-abi.json'

const supportedServiceNodeAbis = new Set(serviceNativeAbi.supportedServiceNodeAbis)
const nodeVersionPattern = /^v?(\d+)\.(\d+)\.(\d+)/u
const maximumServiceNodeMajor = serviceNativeAbi.supportedServiceNodeMajors.at(-1)

const NodeRuntimeProbe = Schema.Struct({
  version: Schema.String,
  abi: Schema.String,
})
export interface NodeRuntimeProbe extends Schema.Schema.Type<typeof NodeRuntimeProbe> {}

export function getSupportedServiceNodeAbiLabel() {
  return [...supportedServiceNodeAbis].join(', ')
}

function rejectNodeProbeExit(nodeExecutable: string, stderr: string, code: number | null) {
  return new Error(
    `Failed to probe Node runtime ${nodeExecutable} (exit ${code ?? 'unknown'}): ${stderr.trim()}`,
  )
}

function isAtLeastNodeVersion(version: string, minimumVersion: string) {
  const versionParts = version.match(nodeVersionPattern)?.slice(1).map(Number)
  const minimumParts = minimumVersion.match(nodeVersionPattern)?.slice(1).map(Number)
  if (!(versionParts && minimumParts)) return false

  for (let index = 0; index < minimumParts.length; index += 1) {
    const part = versionParts[index] ?? 0
    const minimumPart = minimumParts[index] ?? 0
    if (part !== minimumPart) return part > minimumPart
  }
  return true
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
      supportedServiceNodeAbis.has(runtime.abi) &&
      isAtLeastNodeVersion(runtime.version, serviceNativeAbi.minimumServiceNodeVersion)
    )
  ) {
    throw new Error(
      `Howcode desktop service requires Node ABI ${getSupportedServiceNodeAbiLabel()} (Node ${serviceNativeAbi.minimumServiceNodeVersion}+ through ${maximumServiceNodeMajor}). ${input.nodeExecutable} is ${runtime.version} ABI ${runtime.abi}.`,
    )
  }

  return runtime
}
