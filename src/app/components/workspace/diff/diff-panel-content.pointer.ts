import type { AnnotationSide } from "@pierre/diffs/react";

export function resolvePointerLineTarget(event: MouseEvent | PointerEvent): {
  side: AnnotationSide;
  lineNumber: number;
} | null {
  const path = event.composedPath?.() ?? [];
  let numberElement: HTMLElement | null = null;
  let codeElement: HTMLElement | null = null;
  let lineType: string | null = null;
  let lineNumber: number | null = null;

  for (const node of path) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (
      node instanceof HTMLButtonElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLInputElement ||
      node instanceof HTMLSelectElement
    ) {
      return null;
    }

    if (node.hasAttribute("data-title") || node.hasAttribute("data-file-info")) {
      return null;
    }

    if (!numberElement) {
      const columnNumber = node.getAttribute("data-column-number");
      if (columnNumber) {
        const parsedLineNumber = Number.parseInt(columnNumber, 10);
        if (!Number.isNaN(parsedLineNumber)) {
          numberElement = node;
          lineNumber = parsedLineNumber;
          lineType = node.getAttribute("data-line-type");
          continue;
        }
      }
    }

    if (lineNumber == null) {
      const lineAttribute = node.getAttribute("data-line");
      if (lineAttribute) {
        const parsedLineNumber = Number.parseInt(lineAttribute, 10);
        if (!Number.isNaN(parsedLineNumber)) {
          lineNumber = parsedLineNumber;
          lineType = node.getAttribute("data-line-type");
          continue;
        }
      }
    }

    if (!codeElement && node.hasAttribute("data-code")) {
      codeElement = node;
      break;
    }
  }

  if (!codeElement || lineNumber == null) {
    return null;
  }

  const side: AnnotationSide =
    lineType === "change-deletion"
      ? "deletions"
      : lineType === "change-addition"
        ? "additions"
        : codeElement.hasAttribute("data-deletions")
          ? "deletions"
          : "additions";

  return { side, lineNumber };
}
