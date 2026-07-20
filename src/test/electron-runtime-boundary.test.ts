import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(__dirname, '..', '..')
const electronMainRoot = path.join(projectRoot, 'src/electron/main')
const sourceFileExtensionPattern = /\.ts$/
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
  'desktop/terminal/manager',
  'desktop/terminal/runtime',
  'desktop/thread-state-db',
]

function walkFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const absolute = path.join(dir, entry)
    const stat = statSync(absolute)
    if (stat.isDirectory()) {
      files.push(...walkFiles(absolute))
    } else if (sourceFileExtensionPattern.test(entry)) {
      files.push(absolute)
    }
  }
  return files
}

describe('Electron runtime boundary', () => {
  it('keeps Electron main from importing desktop runtime and native DB modules', () => {
    const files = walkFiles(electronMainRoot)
    const violations: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const repoPath = path.relative(projectRoot, file).replaceAll(path.sep, '/')
      for (const forbidden of forbiddenElectronMainImports) {
        if (source.includes(forbidden)) violations.push(`${repoPath}: ${forbidden}`)
      }
    }

    expect(violations).toEqual([])
  })
})
