import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(__dirname, '..', '..')
const forbiddenElectronMainImports = [
  'better-sqlite3',
  'desktop/app-settings',
  'desktop/artifact-state-db',
  'desktop/chat-state-db',
  'desktop/pi-desktop-runtime',
  'desktop/pi-module',
  'desktop/pi-skills',
  'desktop/pi-threads',
  'desktop/runtime-host/main-request-handlers',
  'desktop/skill-creator-session',
  'desktop/terminal/manager',
  'desktop/thread-state-db',
]

function listFiles(command: string) {
  const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
  return execFileSync('bash', ['-lc', command], { cwd: projectRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

describe('Electron runtime boundary', () => {
  it('keeps Electron main from importing desktop runtime and native DB modules', () => {
    const files = listFiles("find src/electron/main -type f -name '*.ts'")
    const violations: string[] = []
    for (const file of files) {
      const source = readFileSync(path.join(projectRoot, file), 'utf8')
      for (const forbidden of forbiddenElectronMainImports) {
        if (source.includes(forbidden)) violations.push(`${file}: ${forbidden}`)
      }
    }

    expect(violations).toEqual([])
  })
})
