import * as Effect from 'effect/Effect'
import { discoverNodeExecutable } from '../../node-runtime/node-executable'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

let cachedNodeExecutable: string | null = null

export async function getSystemNodeExecutable() {
  if (cachedNodeExecutable) return cachedNodeExecutable

  const discovered = await Effect.runPromise(
    discoverNodeExecutable({
      environmentCandidates: [
        getProcessEnvironmentVariable('HOWCODE_NODE_PATH'),
        getProcessEnvironmentVariable('NODE'),
      ],
      requireAbsoluteEnvironmentPath: true,
      requireAbsoluteShellPath: false,
      shellFlags: (shellName) => (shellName === 'sh' || shellName === 'dash' ? ['-c'] : ['-lc']),
      shells: [getProcessEnvironmentVariable('SHELL'), '/bin/bash', '/bin/zsh', '/bin/sh'],
    }),
  )
  cachedNodeExecutable = discovered ?? 'node'
  return cachedNodeExecutable
}
