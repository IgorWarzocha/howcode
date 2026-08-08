export type DiffSide = 'deletions' | 'additions'

export type DiffPoint = {
  side: DiffSide
  lineNumber: number
}

export type LineRangeReviewTarget = {
  kind: 'line-range'
  fileKey: string
  filePath: string
  start: DiffPoint
  end: DiffPoint
}

export type FileReviewTarget = {
  kind: 'file'
  fileKey: string
  filePath: string
}

export type ReviewTarget = LineRangeReviewTarget | FileReviewTarget

export type ReviewDraft = {
  target: ReviewTarget
  body: string
}

export type SavedReviewComment = ReviewDraft & {
  id: string
  createdAt: string
}

export function normalizeLineRangeTarget({
  end,
  fileKey,
  filePath,
  start,
}: Omit<LineRangeReviewTarget, 'kind'>): LineRangeReviewTarget {
  if (start.side !== end.side || start.lineNumber <= end.lineNumber) {
    return { kind: 'line-range', fileKey, filePath, start: { ...start }, end: { ...end } }
  }

  return { kind: 'line-range', fileKey, filePath, start: { ...end }, end: { ...start } }
}

export function createLineRangeTarget({
  endLineNumber,
  endSide,
  fileKey,
  filePath,
  lineNumber,
  side,
}: {
  fileKey: string
  filePath: string
  side: DiffSide
  lineNumber: number
  endSide?: DiffSide | undefined
  endLineNumber?: number | undefined
}) {
  return normalizeLineRangeTarget({
    fileKey,
    filePath,
    start: { side, lineNumber },
    end: { side: endSide ?? side, lineNumber: endLineNumber ?? lineNumber },
  })
}

export function isSameReviewTarget(left: ReviewTarget, right: ReviewTarget) {
  if (
    left.kind !== right.kind ||
    left.fileKey !== right.fileKey ||
    left.filePath !== right.filePath
  ) {
    return false
  }

  if (left.kind === 'file' || right.kind === 'file') return true
  return (
    left.start.side === right.start.side &&
    left.start.lineNumber === right.start.lineNumber &&
    left.end.side === right.end.side &&
    left.end.lineNumber === right.end.lineNumber
  )
}

function getSideLabel(side: DiffSide, casing: 'title' | 'lower') {
  if (side === 'deletions') return casing === 'title' ? 'Old' : 'old'
  return casing === 'title' ? 'New' : 'new'
}

export function describeReviewTarget(target: ReviewTarget) {
  if (target.kind === 'file') return 'File comment'

  const { start, end } = target
  const startLabel = getSideLabel(start.side, 'title')
  if (start.side === end.side) {
    return start.lineNumber === end.lineNumber
      ? `${startLabel} line ${start.lineNumber}`
      : `${startLabel} lines ${start.lineNumber}-${end.lineNumber}`
  }

  return `${startLabel} line ${start.lineNumber} → ${getSideLabel(end.side, 'title')} line ${end.lineNumber}`
}

export function formatReviewTargetLocation(target: ReviewTarget) {
  if (target.kind === 'file') return target.filePath

  const { start, end } = target
  if (start.side === end.side) {
    const lines =
      start.lineNumber === end.lineNumber
        ? `${start.lineNumber}`
        : `${start.lineNumber}-${end.lineNumber}`
    return `${target.filePath}:${lines} (${getSideLabel(start.side, 'lower')} side)`
  }

  return `${target.filePath}:${start.lineNumber} (${getSideLabel(start.side, 'lower')} side) → ${end.lineNumber} (${getSideLabel(end.side, 'lower')} side)`
}

export function getReviewTargetLinesLabel(target: ReviewTarget) {
  if (target.kind === 'file') return 'File'
  return target.start.lineNumber === target.end.lineNumber
    ? `Ln ${target.start.lineNumber}`
    : `Ln ${target.start.lineNumber}:${target.end.lineNumber}`
}
