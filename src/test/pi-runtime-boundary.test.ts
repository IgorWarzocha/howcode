import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '../..')
const desktopRoot = path.join(repoRoot, 'desktop')
const askQuestionsExtensionPath = path.join(
  repoRoot,
  'desktop/native-extensions/howcode-native-ask-questions.mjs',
)
const sourceFileExtensionPattern = /\.(?:cts|ts|mts|tsx)$/

const allowedPiRuntimeImportPrefixes = [
  'desktop/runtime-host/',
  'desktop/runtime/',
  'desktop/pi-module.ts',
  // Package internals are only exported to Electron through runtime-host-bridge.ts; the host
  // imports these implementations directly so native package-manager dependencies stay in Node.
  'desktop/pi-packages/services.ts',
  'desktop/pi-packages/configured.ts',
  'desktop/pi-packages/mutations.ts',
  'desktop/skills/mutations.ts',
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

function toRepoPath(filePath: string) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/')
}

function isAllowedRuntimeFile(repoPath: string) {
  return allowedPiRuntimeImportPrefixes.some((prefix) => repoPath.startsWith(prefix))
}

function resolveImportSpecifier(importerPath: string, specifier: string) {
  if (!specifier.startsWith('.')) return specifier
  const resolved = path.resolve(path.dirname(importerPath), specifier)
  for (const candidate of [resolved, `${resolved}.ts`, `${resolved}.ts`, `${resolved}.mts`]) {
    if (existsSync(candidate)) return toRepoPath(candidate)
  }
  return toRepoPath(resolved)
}

function isForbiddenRuntimeSpecifier(resolvedSpecifier: string) {
  return (
    resolvedSpecifier === './pi-module.ts' ||
    resolvedSpecifier === '../pi-module.ts' ||
    resolvedSpecifier.includes('/pi-module.ts') ||
    resolvedSpecifier.startsWith('desktop/runtime/composer-service.ts') ||
    resolvedSpecifier.startsWith('desktop/runtime/composer-state.ts') ||
    resolvedSpecifier.startsWith('desktop/runtime/runtime-registry.ts') ||
    resolvedSpecifier.startsWith('desktop/runtime/thread-publisher.ts') ||
    resolvedSpecifier.startsWith('@earendil-works/pi-')
  )
}

describe('Pi runtime import boundary', () => {
  it('keeps Pi SDK/runtime imports out of Electron-main-facing desktop modules', () => {
    const violations = walkFiles(desktopRoot)
      .map((filePath) => ({ filePath, repoPath: toRepoPath(filePath) }))
      .filter(({ repoPath }) => !isAllowedRuntimeFile(repoPath))
      .flatMap(({ filePath, repoPath }) => {
        const source = readFileSync(filePath, 'utf8')
        const matches = [
          ...source.matchAll(/from\s+["']([^"']+)["']/g),
          ...source.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g),
        ]
        return matches
          .map((match) => match[1])
          .map((specifier) => ({
            specifier,
            resolvedSpecifier: resolveImportSpecifier(filePath, specifier ?? ''),
          }))
          .filter(({ resolvedSpecifier }) => isForbiddenRuntimeSpecifier(resolvedSpecifier))
          .map(
            ({ specifier, resolvedSpecifier }) =>
              `${repoPath} imports ${specifier} (${resolvedSpecifier})`,
          )
      })

    expect(violations).toEqual([])
  })

  it('keeps the bundled ask-questions extension loadable', async () => {
    await expect(import(pathToFileURL(askQuestionsExtensionPath).href)).resolves.toEqual(
      expect.objectContaining({
        createHowcodeAskQuestionsTool: expect.any(Function),
        default: expect.any(Function),
      }),
    )
  })
})
