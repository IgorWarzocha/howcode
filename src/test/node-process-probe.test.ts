import * as Effect from 'effect/Effect'
import { describe, expect, it } from 'vitest'
import { runProcessProbe } from '../../node-runtime/process-probe'

describe('Node process probes', () => {
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
})
