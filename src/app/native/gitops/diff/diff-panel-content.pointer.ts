import type { AnnotationSide } from '@pierre/diffs/react'

function isIgnoredPointerTarget(node: HTMLElement) {
  return (
    node instanceof HTMLButtonElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLInputElement ||
    node instanceof HTMLSelectElement ||
    node.hasAttribute('data-title') ||
    node.hasAttribute('data-file-info')
  )
}

function readLineNumberAttribute(node: HTMLElement, attribute: string) {
  const value = node.getAttribute(attribute)
  if (!value) return null
  const parsedLineNumber = Number.parseInt(value, 10)
  return Number.isNaN(parsedLineNumber) ? null : parsedLineNumber
}

function resolveLineTargetSide(lineType: string | null, codeElement: HTMLElement): AnnotationSide {
  if (lineType === 'change-deletion') return 'deletions'
  if (lineType === 'change-addition') return 'additions'
  return codeElement.hasAttribute('data-deletions') ? 'deletions' : 'additions'
}

type PointerLineScanState = {
  codeElement: HTMLElement | null
  lineType: string | null
  lineNumber: number | null
  numberElement: HTMLElement | null
}

function applyPointerLineNode(
  state: PointerLineScanState,
  node: HTMLElement,
): PointerLineScanState {
  if (!state.numberElement) {
    const parsedLineNumber = readLineNumberAttribute(node, 'data-column-number')
    if (parsedLineNumber !== null) {
      return {
        ...state,
        numberElement: node,
        lineNumber: parsedLineNumber,
        lineType: node.getAttribute('data-line-type'),
      }
    }
  }

  if (state.lineNumber == null) {
    const parsedLineNumber = readLineNumberAttribute(node, 'data-line')
    if (parsedLineNumber !== null) {
      return {
        ...state,
        lineNumber: parsedLineNumber,
        lineType: node.getAttribute('data-line-type'),
      }
    }
  }

  return !state.codeElement && node.hasAttribute('data-code')
    ? { ...state, codeElement: node }
    : state
}

export function resolvePointerLineTarget(event: MouseEvent | PointerEvent): {
  side: AnnotationSide
  lineNumber: number
} | null {
  const path = event.composedPath?.() ?? []
  let state: PointerLineScanState = {
    codeElement: null,
    lineNumber: null,
    lineType: null,
    numberElement: null,
  }

  for (const node of path) {
    if (!(node instanceof HTMLElement)) {
      continue
    }

    if (isIgnoredPointerTarget(node)) return null

    state = applyPointerLineNode(state, node)
    if (state.codeElement) break
  }

  if (!state.codeElement || state.lineNumber == null) {
    return null
  }

  return {
    side: resolveLineTargetSide(state.lineType, state.codeElement),
    lineNumber: state.lineNumber,
  }
}
