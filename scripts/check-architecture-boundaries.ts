import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const sourceRoots = [
  'src/app',
  'src/electron',
  'src/desktop-host',
  'desktop',
  'shared',
  'scripts',
  'packages/howcode',
  'pages/src',
  'workers/polls/src',
] as const
const sourceExtensions = ['.ts', '.tsx', '.js', '.cjs', '.mjs'] as const
const testFilePattern = /\.(?:spec|test)\.[cm]?[jt]sx?$/u
const ignoredDirectoryPattern = /(?:^|\/)(?:artifacts|build|dist|node_modules)(?:\/|$)/u

type Layer =
  | 'renderer'
  | 'electron'
  | 'host'
  | 'service'
  | 'shared'
  | 'scripts'
  | 'launcher'
  | 'pages'
  | 'worker'

type AliasEntry = {
  prefix: string
  suffix: string
  targetPrefix: string
  targetSuffix: string
}

function toRepoPath(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, '/')
}

async function collectSourceFiles() {
  const files: string[] = []
  const glob = new Bun.Glob('**/*.{ts,tsx,js,cjs,mjs}')
  for (const root of sourceRoots) {
    for await (const relativePath of glob.scan({ cwd: root, onlyFiles: true })) {
      if (testFilePattern.test(relativePath) || ignoredDirectoryPattern.test(relativePath)) continue
      files.push(path.resolve(root, relativePath))
    }
  }
  return files
}

function readAliases(): AliasEntry[] {
  const config = JSON.parse(readFileSync('tsconfig.json', 'utf8')) as {
    compilerOptions?: { paths?: Record<string, string[]> }
  }
  const paths = config.compilerOptions?.paths ?? {}
  return Object.entries(paths).flatMap(([pattern, targets]) => {
    const star = pattern.indexOf('*')
    const prefix = star < 0 ? pattern : pattern.slice(0, star)
    const suffix = star < 0 ? '' : pattern.slice(star + 1)
    return targets.map((target) => {
      const targetStar = target.indexOf('*')
      return {
        prefix,
        suffix,
        targetPrefix: targetStar < 0 ? target : target.slice(0, targetStar),
        targetSuffix: targetStar < 0 ? '' : target.slice(targetStar + 1),
      }
    })
  })
}

function sourceCandidates(basePath: string) {
  const extension = path.extname(basePath)
  if (sourceExtensions.includes(extension as (typeof sourceExtensions)[number])) {
    const withoutExtension = basePath.slice(0, -extension.length)
    return [basePath, ...sourceExtensions.map((candidate) => `${withoutExtension}${candidate}`)]
  }
  return [
    basePath,
    ...sourceExtensions.map((candidate) => `${basePath}${candidate}`),
    ...sourceExtensions.map((candidate) => path.join(basePath, `index${candidate}`)),
  ]
}

function resolveSourceFile(basePath: string, sourceFiles: ReadonlySet<string>) {
  return sourceCandidates(path.resolve(basePath)).find((candidate) => sourceFiles.has(candidate))
}

function resolveImport(
  importer: string,
  specifier: string,
  aliases: readonly AliasEntry[],
  sourceFiles: ReadonlySet<string>,
) {
  if (specifier.startsWith('.')) {
    return resolveSourceFile(path.resolve(path.dirname(importer), specifier), sourceFiles)
  }
  for (const alias of aliases) {
    if (!(specifier.startsWith(alias.prefix) && specifier.endsWith(alias.suffix))) continue
    const wildcard = specifier.slice(alias.prefix.length, specifier.length - alias.suffix.length)
    const target = `${alias.targetPrefix}${wildcard}${alias.targetSuffix}`
    const resolved = resolveSourceFile(target, sourceFiles)
    if (resolved) return resolved
  }
  return undefined
}

function getImportSpecifiers(filePath: string) {
  const source = readFileSync(filePath, 'utf8')
  const specifiers: string[] = []
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]
      if (specifier) specifiers.push(specifier)
    }
  }
  return specifiers
}

function getLayer(filePath: string): Layer {
  const repoPath = toRepoPath(filePath)
  if (repoPath.startsWith('src/app/')) return 'renderer'
  if (repoPath.startsWith('src/electron/')) return 'electron'
  if (repoPath.startsWith('src/desktop-host/')) return 'host'
  if (repoPath.startsWith('desktop/')) return 'service'
  if (repoPath.startsWith('shared/')) return 'shared'
  if (repoPath.startsWith('scripts/')) return 'scripts'
  if (repoPath.startsWith('pages/src/')) return 'pages'
  if (repoPath.startsWith('workers/polls/src/')) return 'worker'
  return 'launcher'
}

function isForbiddenBoundary(from: Layer, to: Layer) {
  switch (from) {
    case 'shared':
      return to !== 'shared'
    case 'service':
      return to === 'renderer' || to === 'electron' || to === 'host'
    case 'host':
      return to === 'renderer' || to === 'electron' || to === 'service'
    case 'electron':
      return to === 'renderer' || to === 'service'
    case 'renderer':
      return to === 'electron' || to === 'host' || to === 'service'
    case 'launcher':
      return to !== 'launcher'
    case 'scripts':
      return false
    case 'pages':
      return to !== 'pages' && to !== 'shared'
    case 'worker':
      return to !== 'worker' && to !== 'shared'
    default:
      return true
  }
}

function findCycles(graph: ReadonlyMap<string, ReadonlySet<string>>) {
  let nextIndex = 0
  const indexes = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const cycles: string[][] = []

  const updateDependencyLowLink = (
    filePath: string,
    dependency: string,
    visitDependency: (candidate: string) => void,
  ) => {
    if (!indexes.has(dependency)) {
      visitDependency(dependency)
      lowLinks.set(filePath, Math.min(lowLinks.get(filePath) ?? 0, lowLinks.get(dependency) ?? 0))
      return
    }
    if (onStack.has(dependency)) {
      lowLinks.set(filePath, Math.min(lowLinks.get(filePath) ?? 0, indexes.get(dependency) ?? 0))
    }
  }

  const collectComponent = (filePath: string) => {
    const component: string[] = []
    let member: string | undefined
    do {
      member = stack.pop()
      if (!member) break
      onStack.delete(member)
      component.push(member)
    } while (member !== filePath)
    return component
  }

  const visit = (filePath: string) => {
    indexes.set(filePath, nextIndex)
    lowLinks.set(filePath, nextIndex)
    nextIndex += 1
    stack.push(filePath)
    onStack.add(filePath)

    for (const dependency of graph.get(filePath) ?? []) {
      updateDependencyLowLink(filePath, dependency, visit)
    }

    if (lowLinks.get(filePath) !== indexes.get(filePath)) return
    const component = collectComponent(filePath)
    if (component.length > 1) cycles.push(component)
  }

  for (const filePath of graph.keys()) if (!indexes.has(filePath)) visit(filePath)
  return cycles
}

function buildArchitectureGraph(files: string[], aliases: readonly AliasEntry[]) {
  const sourceFiles = new Set(files)
  const graph = new Map(files.map((filePath) => [filePath, new Set<string>()]))
  const boundaryViolations: string[] = []

  for (const importer of files) {
    for (const specifier of getImportSpecifiers(importer)) {
      const dependency = resolveImport(importer, specifier, aliases, sourceFiles)
      if (!dependency || dependency === importer) continue
      graph.get(importer)?.add(dependency)
      const fromLayer = getLayer(importer)
      const toLayer = getLayer(dependency)
      if (isForbiddenBoundary(fromLayer, toLayer)) {
        boundaryViolations.push(
          `${toRepoPath(importer)} imports ${toRepoPath(dependency)} (${fromLayer} -> ${toLayer})`,
        )
      }
    }
  }
  return { boundaryViolations, graph }
}

function reportFailures(boundaryViolations: string[], cycles: string[][]) {
  if (boundaryViolations.length > 0) {
    console.error('Forbidden runtime boundaries:')
    for (const violation of boundaryViolations) console.error(`- ${violation}`)
  }
  if (cycles.length > 0) {
    console.error('Local dependency cycles:')
    for (const cycle of cycles) console.error(`- ${cycle.map(toRepoPath).join(' -> ')}`)
  }
  process.exitCode = 1
}

async function main() {
  if (!existsSync('tsconfig.json')) throw new Error('Run architecture checks from the repo root.')
  const files = await collectSourceFiles()
  const { boundaryViolations, graph } = buildArchitectureGraph(files, readAliases())
  const cycles = findCycles(graph)
  if (boundaryViolations.length > 0 || cycles.length > 0) {
    reportFailures(boundaryViolations, cycles)
    return
  }
  console.log(`Architecture boundaries clean across ${files.length} production files.`)
}

await main()
