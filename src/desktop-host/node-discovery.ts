import { spawn } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

let cachedNodeExecutable: string | null = null

function isExecutableFile(filePath: string) {
  try {
    if (!statSync(filePath).isFile()) return false
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function runShellNodeProbe(shell: string) {
  return new Promise<string | null>((resolve) => {
    const child = spawn(shell, ['-lc', 'command -v node'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    let output = ''
    const timeout = setTimeout(() => {
      child.kill()
      resolve(null)
    }, 2_000)
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk) => {
      output += chunk
    })
    child.once('error', () => {
      clearTimeout(timeout)
      resolve(null)
    })
    child.once('exit', () => {
      clearTimeout(timeout)
      const candidate = output.trim().split('\n')[0]
      resolve(candidate && candidate.length > 0 && isExecutableFile(candidate) ? candidate : null)
    })
  })
}

async function discoverNodeFromShell() {
  const shells = [
    getProcessEnvironmentVariable('SHELL'),
    '/bin/bash',
    '/bin/zsh',
    '/bin/sh',
  ].filter((shell): shell is string => Boolean(shell))

  for (const shell of [...new Set(shells)]) {
    if (!isExecutableFile(shell)) continue
    const candidate = await runShellNodeProbe(shell)
    if (candidate) return candidate
  }
  return null
}

export async function getSystemNodeExecutable() {
  if (cachedNodeExecutable) return cachedNodeExecutable

  for (const candidate of [
    getProcessEnvironmentVariable('HOWCODE_NODE_PATH'),
    getProcessEnvironmentVariable('NODE'),
  ]) {
    const normalized = candidate?.trim()
    if (normalized && isExecutableFile(normalized)) {
      cachedNodeExecutable = normalized
      return cachedNodeExecutable
    }
  }

  const shellNode = await discoverNodeFromShell()
  if (shellNode) {
    cachedNodeExecutable = shellNode
    return cachedNodeExecutable
  }

  cachedNodeExecutable = 'node'
  return cachedNodeExecutable
}
