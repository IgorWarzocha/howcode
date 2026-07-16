import { appTypeCodeClass, appTypeTinyStrongClass } from '@howcode/ui'
import type { Message } from '../types'

type ToolResultMessage = Extract<Message, { role: 'toolResult' }>

type ToolDiff = {
  path?: string
  status?: string
  diff: string
}

type DiffLine = {
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

function getToolArgsRecord(message: ToolResultMessage) {
  return isRecord(message.rawArgs) ? message.rawArgs : null
}

function getApplyPatchText(message: ToolResultMessage) {
  const args = getToolArgsRecord(message)
  return (
    getStringField(args ?? {}, 'input') ??
    getStringField(args ?? {}, 'patchText') ??
    getStringField(args ?? {}, 'patch')
  )
}

function getEditPath(message: ToolResultMessage) {
  const args = getToolArgsRecord(message)
  return getStringField(args ?? {}, 'path') ?? getStringField(args ?? {}, 'file_path')
}

function getDiffFromDetails(message: ToolResultMessage): ToolDiff[] {
  const details = message.details
  if (!isRecord(details)) return []

  const directDiff = getStringField(details, 'diff')
  if (directDiff) {
    return [createToolDiff({ path: getEditPath(message), status: 'M', diff: directDiff })]
  }

  const { fileDiffs } = details
  if (!Array.isArray(fileDiffs)) return []

  return fileDiffs
    .map((entry): ToolDiff | null => {
      if (!isRecord(entry)) return null
      const diff = getStringField(entry, 'diff')
      if (!diff) return null
      return createToolDiff({
        path: getStringField(entry, 'path'),
        status: getStringField(entry, 'status'),
        diff,
      })
    })
    .filter((entry): entry is ToolDiff => entry !== null)
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

function getPatchActionHeader(line: string) {
  const add = line.match(addFileHeaderPattern)
  if (add?.[1]) return { status: 'A', path: add[1].trim() }
  const update = line.match(updateFileHeaderPattern)
  if (update?.[1]) return { status: 'M', path: update[1].trim() }
  const deleted = line.match(deleteFileHeaderPattern)
  if (deleted?.[1]) return { status: 'D', path: deleted[1].trim() }
  return null
}

function pushCurrentPatchDiff(
  diffs: ToolDiff[],
  current: { path: string; status: string; lines: string[] } | null,
) {
  if (!current) return
  diffs.push({ path: current.path, status: current.status, diff: current.lines.join('\n') })
}

function isRenderablePatchLine(line: string) {
  return (
    line.startsWith('@@') || line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')
  )
}

function getDiffsFromApplyPatch(message: ToolResultMessage): ToolDiff[] {
  const patchText = getApplyPatchText(message)
  if (!patchText) return []

  const diffs: ToolDiff[] = []
  let current: { path: string; status: string; lines: string[] } | null = null

  for (const line of patchText.split('\n')) {
    const header = getPatchActionHeader(line)
    if (header) {
      pushCurrentPatchDiff(diffs, current)
      current = { ...header, lines: [] }
      continue
    }

    if (!current) continue
    if (line === '*** End Patch') break
    if (line.startsWith('*** Move to:')) {
      current.lines.push(line)
      continue
    }
    if (isRenderablePatchLine(line)) {
      current.lines.push(line)
    }
  }

  pushCurrentPatchDiff(diffs, current)
  return diffs.filter((diff) => diff.diff.trim().length > 0)
}

function getToolDiffs(message: ToolResultMessage) {
  const detailedDiffs = getDiffFromDetails(message)
  if (detailedDiffs.length > 0) return detailedDiffs
  if (message.toolName === 'apply_patch') return getDiffsFromApplyPatch(message)
  return []
}

function getToolDiffSummary(message: ToolResultMessage) {
  const diffs = getToolDiffs(message)
  if (diffs.length === 0) return null
  return countChangedLines(diffs)
}

export function ToolDiffSummary({ message }: { message: ToolResultMessage }) {
  const summary = getToolDiffSummary(message)
  if (!summary) return null
  return (
    <span className={`shrink-0 ${appTypeTinyStrongClass}`}>
      <span className="text-[color:var(--green)]">+{summary.added}</span>
      <span className="px-1 text-[color:var(--muted-2)]/70">/</span>
      <span className="text-[color:var(--danger)]">-{summary.removed}</span>
    </span>
  )
}

function getLineKind(line: string): DiffLine['kind'] {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'add'
  if (line.startsWith('-') && !line.startsWith('---')) return 'remove'
  if (
    line.startsWith('@@') ||
    line.startsWith('***') ||
    line.startsWith('---') ||
    line.startsWith('+++')
  ) {
    return 'meta'
  }
  return 'context'
}

function parseDiffLines(diff: string): DiffLine[] {
  return diff
    .split('\n')
    .map((line, index) => ({ key: `${index}:${line}`, text: line, kind: getLineKind(line) }))
}

function countChangedLines(diffs: ToolDiff[]) {
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

function DiffLineView({ line }: { line: DiffLine }) {
  const className =
    line.kind === 'add'
      ? 'bg-[color:color-mix(in_srgb,var(--green)_14%,transparent)] text-[color:var(--green)]'
      : line.kind === 'remove'
        ? 'bg-[color:color-mix(in_srgb,var(--danger-bg)_36%,transparent)] text-[color:var(--danger)]'
        : line.kind === 'meta'
          ? 'text-[color:var(--accent)]'
          : 'text-[color:var(--muted-2)]/88'

  return <span className={`block ${className}`}>{line.text || ' '}</span>
}

export function ToolDiffBlock({ message }: { message: ToolResultMessage }) {
  const diffs = getToolDiffs(message)
  if (diffs.length === 0) return null

  return (
    <div className="grid min-w-0 gap-2">
      <div className={`grid min-w-0 gap-2 ${appTypeCodeClass}`}>
        {diffs.map((diff) => (
          <div
            key={`${diff.path ?? 'diff'}:${diff.status ?? ''}:${diff.diff}`}
            className="min-w-0 overflow-hidden"
          >
            {diff.path ? (
              <div className="truncate pb-0.5 pl-1 text-[color:var(--muted)]/84">
                {diff.status ? `${diff.status} ` : ''}
                {diff.path}
              </div>
            ) : null}
            <pre className="m-0 max-h-80 overflow-auto whitespace-pre text-left">
              {parseDiffLines(diff.diff).map((line) => (
                <DiffLineView key={line.key} line={line} />
              ))}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
