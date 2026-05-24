import { readFile } from 'node:fs/promises'
import path from 'node:path'

type Finding = {
  label: string
  line: number
  column: number
  match: string
  text: string
}

type Pattern = {
  label: string
  regex: RegExp
}

const projectRoot = process.cwd()

const patterns: Pattern[] = [
  { label: 'raw text size', regex: /\btext-\[(?!color:)[^\]\s]+\]/g },
  { label: 'tailwind text scale', regex: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g },
  { label: 'raw leading', regex: /\bleading-\[[^\]\s]+\]/g },
  {
    label: 'tailwind leading scale',
    regex: /\bleading-(?:3|4|5|6|7|8|9|10|none|tight|snug|normal|relaxed|loose)\b/g,
  },
  { label: 'inline fontSize style', regex: /\bfontSize\s*:/g },
  { label: 'inline lineHeight style', regex: /\blineHeight\s*:/g },
  { label: 'style prop', regex: /\bstyle=\{\{/g },
  {
    label: 'font class',
    regex:
      /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|mono|sans|serif)\b/g,
  },
  {
    label: 'tracking',
    regex: /\btracking-(?:\[[^\]]+\]|tighter|tight|normal|wide|wider|widest)\b/g,
  },
  {
    label: 'local typography helper name',
    regex:
      /\b\w*(?:Text|Title|Heading|Label|Meta|Muted|Note|Description|Control|Body|Copy|Caption)Class\b/g,
  },
]

const allowedAppRolePattern = /\b(?:appType\w+Class|appTone\w+Class)\b/

function parseNumberFlag(name: string, fallback: number) {
  const arg = process.argv.find((argument) => argument.startsWith(`--${name}=`))
  if (!arg) return fallback
  const rawValue = arg.slice(name.length + 3)
  const parsedValue = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback
}

function parseStringFlag(name: string, fallback: string) {
  const arg = process.argv.find((value) => value.startsWith(`--${name}=`))
  if (!arg) return fallback
  return arg.slice(name.length + 3)
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`)
}

function getLineStarts(text: string) {
  const starts = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') starts.push(index + 1)
  }
  return starts
}

function getPosition(lineStarts: number[], index: number) {
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const start = lineStarts[mid]
    const next = lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY
    if (start === undefined) break
    if (index < start) {
      high = mid - 1
    } else if (index >= next) {
      low = mid + 1
    } else {
      return { line: mid + 1, column: index - start + 1 }
    }
  }
  return { line: 1, column: index + 1 }
}

function findTypography(fileText: string) {
  const findings: Finding[] = []
  const lineStarts = getLineStarts(fileText)
  const lines = fileText.split('\n')

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0
    for (const match of fileText.matchAll(pattern.regex)) {
      if (match.index === undefined) continue
      const { line, column } = getPosition(lineStarts, match.index)
      const text = lines[line - 1]?.trim() ?? ''
      const matchText = match[0]
      if (
        pattern.label === 'local typography helper name' &&
        allowedAppRolePattern.test(matchText)
      ) {
        continue
      }
      findings.push({ label: pattern.label, line, column, match: matchText, text })
    }
  }

  return findings.sort((left, right) => left.line - right.line || left.column - right.column)
}

function scoreFindings(findings: Finding[]) {
  return findings.reduce((score, finding) => {
    if (finding.label.includes('inline')) return score + 5
    if (finding.label === 'style prop') return score + 3
    if (finding.label.includes('raw')) return score + 3
    if (finding.label === 'local typography helper name') return score + 2
    return score + 1
  }, 0)
}

async function main() {
  const limit = parseNumberFlag('limit', 10)
  const offset = parseNumberFlag('offset', 0)
  const scope = parseStringFlag('scope', 'src/app')
  const showClean = hasFlag('show-clean')
  const all = hasFlag('all')
  const json = hasFlag('json')
  const glob = new Bun.Glob('**/*.{tsx,jsx}')
  const files: string[] = []

  for await (const file of glob.scan({ cwd: path.join(projectRoot, scope), onlyFiles: true })) {
    files.push(path.join(scope, file).replaceAll(path.sep, '/'))
  }

  files.sort((left, right) => left.localeCompare(right))

  const selected = all ? files : files.slice(offset, offset + limit)
  const results: Array<{ file: string; score: number; findings: Finding[] }> = []

  for (const file of selected) {
    const fileText = await readFile(path.join(projectRoot, file), 'utf8')
    const findings = findTypography(fileText)
    if (findings.length === 0 && !showClean) continue
    results.push({ file, score: scoreFindings(findings), findings })
  }

  if (json) {
    console.log(
      JSON.stringify({ scope, offset, limit, totalFiles: files.length, results }, null, 2),
    )
    return
  }

  console.log(`Typography audit: ${scope}`)
  console.log(`Files: ${files.length}. Window: ${all ? 'all' : `${offset}..${offset + limit - 1}`}`)
  console.log(`Run next: bun run typography:audit -- --offset=${offset + limit}`)
  console.log('')

  if (results.length === 0) {
    console.log('No findings in this window.')
    return
  }

  for (const result of results) {
    console.log(`${result.file}  score=${result.score} findings=${result.findings.length}`)
    for (const finding of result.findings) {
      console.log(`  ${finding.line}:${finding.column}  ${finding.label}  ${finding.match}`)
      console.log(`    ${finding.text}`)
    }
    console.log('')
  }
}

await main()
