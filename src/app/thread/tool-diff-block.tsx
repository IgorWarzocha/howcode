import { appTypeCodeClass, appTypeTinyStrongClass } from '@howcode/ui'
import {
  getToolDiffSummary,
  getToolDiffs,
  parseToolDiffLines,
  type ToolDiffLine,
  type ToolResultMessage,
} from './tool-diff'

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

function DiffLineView({ line }: { line: ToolDiffLine }) {
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
              {parseToolDiffLines(diff.diff).map((line) => (
                <DiffLineView key={line.key} line={line} />
              ))}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
