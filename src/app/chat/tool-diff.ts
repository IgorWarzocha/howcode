import type { Message } from '../types'

export type ToolResultMessage = Extract<Message, { role: 'toolResult' }>

export type ToolDiff = {
  path?: string
  status?: string
  diff: string
}

export type ToolDiffLine = {
  key: string
  text: string
  kind: 'add' | 'remove' | 'meta' | 'context'
}

const addFileHeaderPattern = /^\*\*\* Add File:\s+(.+)$/
const updateFileHeaderPattern = /^\*\*\* Update File:\s+(.+)$/
const deleteFileHeaderPattern = /^\*\*\* Delete File:\s+(.+)$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStringField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function createToolDiff(input: {
  path?: string | undefined
  status?: string | undefined
  diff: string
}): ToolDiff {
  return {
    ...(input.path ? { path: input.path } : {}),
    ...(input.status ? { status: input.status } : {}),
    diff: input.diff,
  }
}

function getDiffFromDetails(message: ToolResultMessage): ToolDiff[] {
  if (!isRecord(message.details)) return []
  const directDiff = getStringField(message.details, 'diff')
  if (directDiff) {
    const args = isRecord(message.rawArgs) ? message.rawArgs : {}
    return [
      createToolDiff({
        path: getStringField(args, 'path') ?? getStringField(args, 'file_path'),
        status: 'M',
        diff: directDiff,
      }),
    ]
  }

  const { fileDiffs } = message.details
  if (!Array.isArray(fileDiffs)) return []
  return fileDiffs.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const diff = getStringField(entry, 'diff')
    if (!diff) return []
    return [
      createToolDiff({
        path: getStringField(entry, 'path'),
        status: getStringField(entry, 'status'),
        diff,
      }),
    ]
  })
}

function getPatchActionHeader(line: string) {
  const add = line.match(addFileHeaderPattern)
  if (add?.[1]) return { status: 'A', path: add[1].trim() }
  const update = line.match(updateFileHeaderPattern)
  if (update?.[1]) return { status: 'M', path: update[1].trim() }
  const deleted = line.match(deleteFileHeaderPattern)
  if (deleted?.[1]) return { status: 'D', path: deleted[1].trim() }
  return null
}

function getApplyPatchText(message: ToolResultMessage) {
  const args = isRecord(message.rawArgs) ? message.rawArgs : {}
  return (
    getStringField(args, 'input') ??
    getStringField(args, 'patchText') ??
    getStringField(args, 'patch')
  )
}

function getDiffsFromApplyPatch(message: ToolResultMessage): ToolDiff[] {
  const patchText = getApplyPatchText(message)
  if (!patchText) return []

  const diffs: ToolDiff[] = []
  let current: { path: string; status: string; lines: string[] } | null = null
  const flush = () => {
    if (!current) return
    diffs.push({ path: current.path, status: current.status, diff: current.lines.join('\n') })
  }

  for (const line of patchText.split('\n')) {
    const header = getPatchActionHeader(line)
    if (header) {
      flush()
      current = { ...header, lines: [] }
      continue
    }
    if (!current) continue
    if (line === '*** End Patch') break
    if (
      line.startsWith('*** Move to:') ||
      line.startsWith('@@') ||
      line.startsWith('+') ||
      line.startsWith('-') ||
      line.startsWith(' ')
    ) {
      current.lines.push(line)
    }
  }

  flush()
  return diffs.filter((diff) => diff.diff.trim().length > 0)
}

export function getToolDiffs(message: ToolResultMessage) {
  const detailedDiffs = getDiffFromDetails(message)
  if (detailedDiffs.length > 0) return detailedDiffs
  return message.toolName === 'apply_patch' ? getDiffsFromApplyPatch(message) : []
}

export function countToolDiffLines(diffs: ToolDiff[]) {
  let added = 0
  let removed = 0
  for (const diff of diffs) {
    for (const line of diff.diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) added += 1
      if (line.startsWith('-') && !line.startsWith('---')) removed += 1
    }
  }
  return { added, removed }
}

export function getToolDiffSummary(message: ToolResultMessage) {
  const diffs = getToolDiffs(message)
  return diffs.length > 0 ? countToolDiffLines(diffs) : null
}

export function parseToolDiffLines(diff: string): ToolDiffLine[] {
  return diff.split('\n').map((line, index) => ({
    key: `${index}:${line}`,
    text: line,
    kind:
      line.startsWith('+') && !line.startsWith('+++')
        ? 'add'
        : line.startsWith('-') && !line.startsWith('---')
          ? 'remove'
          : line.startsWith('@@') ||
              line.startsWith('***') ||
              line.startsWith('---') ||
              line.startsWith('+++')
            ? 'meta'
            : 'context',
  }))
}
