import * as Effect from 'effect/Effect'
import { describe, expect, it } from 'vitest'
import { runProcessProbe } from '../../node-runtime/process-probe'
import { probeNodeRuntime } from '../desktop-host/service-native-runtime'

describe('Node process probes', () => {
  it('collects process output and exit status', async () => {
    const result = await Effect.runPromise(
      runProcessProbe({
        executable: process.execPath,
        args: ['-e', "process.stdout.write('out'); process.stderr.write('err'); process.exit(7)"],
        timeout: 1_000,
        timeoutMessage: 'Test probe timed out.',
      }),
    )

    expect(result).toEqual({ stdout: 'out', stderr: 'err', exitCode: 7 })
  })

  it('writes stdin to the child process', async () => {
    const result = await Effect.runPromise(
      runProcessProbe({
        executable: process.execPath,
        args: [
          '-e',
          "process.stdin.setEncoding('utf8'); let input = ''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => process.stdout.write(input.toUpperCase()))",
        ],
        stdin: 'migrate',
        timeout: 1_000,
        timeoutMessage: 'Test stdin probe timed out.',
      }),
    )

    expect(result).toEqual({ stdout: 'MIGRATE', stderr: '', exitCode: 0 })
  })

  it('decodes the stock Node version and ABI probe', async () => {
    const runtime = await probeNodeRuntime(process.execPath)

    expect(runtime).toEqual({ version: process.version, abi: process.versions.modules })
  })
})
