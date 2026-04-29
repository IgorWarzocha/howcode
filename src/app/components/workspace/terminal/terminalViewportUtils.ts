import type { WTerm } from "@wterm/react";
import type { CSSProperties } from "react";

export type TerminalBackgroundCssVar = "--terminal-bg" | "--workspace" | "--sidebar";

type TerminalLinkMatch = {
  text: string;
  start: number;
  end: number;
};

export const MAX_PENDING_TERMINAL_EVENTS = 200;
export const DEFAULT_TERMINAL_COLS = 80;
export const DEFAULT_TERMINAL_ROWS = 24;
export const MIN_INITIAL_TERMINAL_COLS = 20;
export const MIN_INITIAL_TERMINAL_ROWS = 5;
export const DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT = 12 * 60 * 60 * 1_000;

const CLEAR_TERMINAL_SEQUENCE = "\u001b[2J\u001b[3J\u001b[H";
const MAX_FRONTEND_HISTORY_CHARS = 200_000;
const TRIMMED_FRONTEND_HISTORY_CHARS = 160_000;
const TERMINAL_LINK_PATTERN = /https?:\/\/[^\s)\]}]+/g;
const MIN_USABLE_TERMINAL_COLS = 2;
const MIN_USABLE_TERMINAL_ROWS = 2;
const TERMINAL_STICKY_BOTTOM_THRESHOLD_PX = 24;
const ANSI_ESCAPE = String.fromCharCode(27);

export function hasVisibleTerminalHistory(history: string) {
  return (
    history
      .split(ANSI_ESCAPE)
      .map((segment, index) =>
        index === 0 ? segment : segment.replace(/^\[[0-?]*[ -/]*[@-~]/, ""),
      )
      .join("")
      .trim().length > 0
  );
}

export function writeSystemMessage(write: (data: string) => void, message: string) {
  write(`\r\n[terminal] ${message}\r\n`);
}

export function clearTerminal(write: (data: string) => void) {
  write(CLEAR_TERMINAL_SEQUENCE);
}

export function clampTerminalHistory(history: string) {
  return history.length > MAX_FRONTEND_HISTORY_CHARS
    ? history.slice(-TRIMMED_FRONTEND_HISTORY_CHARS)
    : history;
}

export function extractTerminalLinks(line: string): TerminalLinkMatch[] {
  const matches = [...line.matchAll(TERMINAL_LINK_PATTERN)];
  return matches.map((match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function getCaretPositionFromPoint(document: Document, clientX: number, clientY: number) {
  const documentWithCaretApi = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const caretPosition = documentWithCaretApi.caretPositionFromPoint?.(clientX, clientY);
  if (caretPosition) {
    return {
      node: caretPosition.offsetNode,
      offset: caretPosition.offset,
    };
  }

  const caretRange = documentWithCaretApi.caretRangeFromPoint?.(clientX, clientY);
  if (caretRange) {
    return {
      node: caretRange.startContainer,
      offset: caretRange.startOffset,
    };
  }

  return null;
}

function findTerminalRow(container: HTMLElement, node: Node | null) {
  let current: Node | null = node;

  while (current) {
    if (current instanceof HTMLElement && current.classList.contains("term-row")) {
      return container.contains(current) ? current : null;
    }

    current = current.parentNode;
  }

  return null;
}

function getRowTextOffset(row: HTMLElement, node: Node, offset: number) {
  const range = row.ownerDocument.createRange();

  try {
    range.setStart(row, 0);
    range.setEnd(node, offset);
  } catch {
    return null;
  }

  return range.toString().length;
}

export function findTerminalLinkAtPoint(container: HTMLElement, clientX: number, clientY: number) {
  const caret = getCaretPositionFromPoint(container.ownerDocument, clientX, clientY);
  if (!caret) {
    return null;
  }

  const row = findTerminalRow(container, caret.node);
  if (!row) {
    return null;
  }

  const rowTextOffset = getRowTextOffset(row, caret.node, caret.offset);
  if (rowTextOffset === null) {
    return null;
  }

  const lineText = row.textContent ?? "";
  return (
    extractTerminalLinks(lineText).find(
      (match) => rowTextOffset >= match.start && rowTextOffset < match.end,
    ) ?? null
  );
}

export function hasSelectionInside(container: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
    return false;
  }

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;

  return Boolean(
    (anchorNode && container.contains(anchorNode)) || (focusNode && container.contains(focusNode)),
  );
}

export function normalizeTerminalDimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function isUsableTerminalSize(cols: number, rows: number) {
  return cols >= MIN_USABLE_TERMINAL_COLS && rows >= MIN_USABLE_TERMINAL_ROWS;
}

export function measureTerminalSize(terminal: WTerm) {
  const element = terminal.element;
  const grid = element.querySelector<HTMLElement>(".term-grid");
  if (!grid) {
    return null;
  }

  const row = element.ownerDocument.createElement("div");
  row.className = "term-row";
  row.style.visibility = "hidden";
  row.style.position = "absolute";

  const probe = element.ownerDocument.createElement("span");
  probe.textContent = "W";
  row.appendChild(probe);
  grid.appendChild(row);

  const charWidth = probe.getBoundingClientRect().width;
  const rowHeight = row.getBoundingClientRect().height;
  row.remove();

  if (charWidth <= 0 || rowHeight <= 0) {
    return null;
  }

  const styles = getComputedStyle(element);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  const contentWidth = element.clientWidth - paddingLeft - paddingRight;
  const contentHeight = element.clientHeight - paddingTop - paddingBottom;

  if (contentWidth <= 0 || contentHeight <= 0) {
    return null;
  }

  return {
    cols: Math.max(1, Math.floor(contentWidth / charWidth)),
    rows: Math.max(1, Math.floor(contentHeight / rowHeight)),
  };
}

export function terminalWrapperStyle(backgroundCssVar: TerminalBackgroundCssVar): CSSProperties {
  return {
    "--terminal-surface": `var(${backgroundCssVar})`,
  } as CSSProperties;
}

export function terminalStyleVars(backgroundCssVar: TerminalBackgroundCssVar): CSSProperties {
  return {
    "--terminal-selection": "rgba(185, 191, 243, 0.18)",
    "--term-bg": `var(${backgroundCssVar})`,
    "--term-fg": "var(--text)",
    "--term-cursor": "var(--accent)",
    "--term-font-family": '"Liberation Mono", Consolas, Menlo, monospace',
    "--term-font-size": "12px",
    "--term-line-height": "1.2",
    "--term-color-0": `var(${backgroundCssVar})`,
    "--term-color-1": "#db7d84",
    "--term-color-2": "var(--green)",
    "--term-color-3": "var(--accent)",
    "--term-color-4": "var(--accent)",
    "--term-color-5": "var(--accent)",
    "--term-color-6": "var(--muted)",
    "--term-color-7": "var(--text)",
    "--term-color-8": "var(--muted-2)",
    "--term-color-9": "#ec979d",
    "--term-color-10": "var(--green)",
    "--term-color-11": "var(--text)",
    "--term-color-12": "var(--text)",
    "--term-color-13": "var(--text)",
    "--term-color-14": "var(--text)",
    "--term-color-15": "#f7f9ff",
  } as CSSProperties;
}

export function isTerminalElementNearBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.clientHeight - element.scrollTop <=
    TERMINAL_STICKY_BOTTOM_THRESHOLD_PX
  );
}
