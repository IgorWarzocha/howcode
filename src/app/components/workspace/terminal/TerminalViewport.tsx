import { Terminal, type TerminalHandle, type WTerm } from "@wterm/react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPersistedSessionPath } from "../../../../../shared/session-paths";
import type { TerminalEvent } from "../../../desktop/types";
import {
  closeDesktopTerminal,
  getDesktopTerminalStatus,
  openDesktopTerminal,
  resizeDesktopTerminal,
  statDesktopTerminalSessionFile,
  subscribeDesktopTerminal,
  writeDesktopTerminal,
} from "../../../hooks/useDesktopTerminal";
import { cn } from "../../../utils/cn";

type TerminalBackgroundCssVar = "--terminal-bg" | "--workspace" | "--sidebar";

type TerminalViewportProps = {
  projectId: string;
  sessionPath: string | null;
  launchMode?: "shell" | "pi-session";
  onProcessExit?: () => void;
  preserveSessionOnUnmount?: boolean;
  keepAliveMsOnUnmount?: number;
  closeWhenSessionFileIdleMs?: number;
  maxKeepAliveMsOnUnmount?: number;
  backgroundCssVar?: TerminalBackgroundCssVar;
  className?: string;
};

type TerminalLinkMatch = {
  text: string;
  start: number;
  end: number;
};

const pendingTerminalCloseTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingTerminalCloseGenerations = new Map<string, number>();

const CLEAR_TERMINAL_SEQUENCE = "\u001b[2J\u001b[3J\u001b[H";
const MAX_PENDING_TERMINAL_EVENTS = 200;
const MAX_FRONTEND_HISTORY_CHARS = 200_000;
const TRIMMED_FRONTEND_HISTORY_CHARS = 160_000;
const TERMINAL_LINK_PATTERN = /https?:\/\/[^\s)\]}]+/g;
const DEFAULT_TERMINAL_COLS = 80;
const DEFAULT_TERMINAL_ROWS = 24;
const MIN_INITIAL_TERMINAL_COLS = 20;
const MIN_INITIAL_TERMINAL_ROWS = 5;
const MIN_USABLE_TERMINAL_COLS = 2;
const MIN_USABLE_TERMINAL_ROWS = 2;
const TERMINAL_STICKY_BOTTOM_THRESHOLD_PX = 24;
const DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT = 12 * 60 * 60 * 1_000;
const MAX_TERMINAL_STATUS_FAILURES_BEFORE_CLOSE = 2;
const ANSI_ESCAPE = String.fromCharCode(27);
type SessionFileStat = { mtimeMs: number; size: number };

function hasVisibleTerminalHistory(history: string) {
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

function closeScheduledTerminal(sessionId: string, generation: number) {
  if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
    return;
  }

  pendingTerminalCloseTimers.delete(sessionId);
  void closeDesktopTerminal({ sessionId }).finally(() => {
    if (pendingTerminalCloseGenerations.get(sessionId) === generation) {
      pendingTerminalCloseGenerations.delete(sessionId);
    }
  });
}

function cancelScheduledTerminalClose(sessionId: string) {
  const timer = pendingTerminalCloseTimers.get(sessionId);
  if (!timer) {
    pendingTerminalCloseGenerations.delete(sessionId);
    return;
  }

  pendingTerminalCloseGenerations.set(
    sessionId,
    (pendingTerminalCloseGenerations.get(sessionId) ?? 0) + 1,
  );
  clearTimeout(timer);
  pendingTerminalCloseTimers.delete(sessionId);
}

function scheduleTerminalClose(sessionId: string, delayMs: number) {
  cancelScheduledTerminalClose(sessionId);
  const generation = (pendingTerminalCloseGenerations.get(sessionId) ?? 0) + 1;
  pendingTerminalCloseGenerations.set(sessionId, generation);

  const timer = setTimeout(() => {
    if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
      return;
    }

    closeScheduledTerminal(sessionId, generation);
  }, delayMs);

  pendingTerminalCloseTimers.set(sessionId, timer);
}

async function pollSessionFileBeforeClosing({
  sessionId,
  pollMs,
  maxKeepAliveMs,
  previousStat,
  statusFailureCount,
  startedAt,
  generation,
}: {
  sessionId: string;
  pollMs: number;
  maxKeepAliveMs: number;
  previousStat: SessionFileStat | null;
  statusFailureCount: number;
  startedAt: number;
  generation: number;
}) {
  if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
    return;
  }

  if (Date.now() - startedAt >= maxKeepAliveMs) {
    closeScheduledTerminal(sessionId, generation);
    return;
  }

  const [currentStat, terminalStatus] = await Promise.all([
    statDesktopTerminalSessionFile(sessionId).catch(() => null),
    getDesktopTerminalStatus(sessionId).catch(() => undefined),
  ]);

  if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
    return;
  }

  const terminalStillRunning =
    terminalStatus?.status === "starting" || terminalStatus?.status === "running";

  if (terminalStatus === undefined) {
    if (statusFailureCount + 1 >= MAX_TERMINAL_STATUS_FAILURES_BEFORE_CLOSE) {
      closeScheduledTerminal(sessionId, generation);
      return;
    }

    scheduleTerminalCloseWhenSessionFileIdle({
      sessionId,
      pollMs,
      maxKeepAliveMs,
      previousStat,
      statusFailureCount: statusFailureCount + 1,
      startedAt,
      generation,
    });
    return;
  }

  if (!terminalStillRunning) {
    closeScheduledTerminal(sessionId, generation);
    return;
  }

  if (!currentStat) {
    if (!previousStat) {
      closeScheduledTerminal(sessionId, generation);
      return;
    }

    scheduleTerminalCloseWhenSessionFileIdle({
      sessionId,
      pollMs,
      maxKeepAliveMs,
      previousStat: null,
      statusFailureCount: 0,
      startedAt,
      generation,
    });
    return;
  }

  if (
    previousStat &&
    currentStat.mtimeMs === previousStat.mtimeMs &&
    currentStat.size === previousStat.size
  ) {
    closeScheduledTerminal(sessionId, generation);
    return;
  }

  scheduleTerminalCloseWhenSessionFileIdle({
    sessionId,
    pollMs,
    maxKeepAliveMs,
    previousStat: currentStat,
    statusFailureCount: 0,
    startedAt,
    generation,
  });
}

function scheduleTerminalCloseWhenSessionFileIdle({
  sessionId,
  pollMs,
  maxKeepAliveMs,
  previousStat,
  statusFailureCount,
  startedAt,
  generation,
}: {
  sessionId: string;
  pollMs: number;
  maxKeepAliveMs: number;
  previousStat: SessionFileStat | null;
  statusFailureCount: number;
  startedAt: number;
  generation: number;
}) {
  const timer = setTimeout(() => {
    void pollSessionFileBeforeClosing({
      sessionId,
      pollMs,
      maxKeepAliveMs,
      previousStat,
      statusFailureCount,
      startedAt,
      generation,
    });
  }, pollMs);

  pendingTerminalCloseTimers.set(sessionId, timer);
}

async function scheduleTerminalCloseAfterSessionFileIdle(
  sessionId: string,
  pollMs: number,
  maxKeepAliveMs: number,
) {
  cancelScheduledTerminalClose(sessionId);
  const generation = (pendingTerminalCloseGenerations.get(sessionId) ?? 0) + 1;
  pendingTerminalCloseGenerations.set(sessionId, generation);
  const startedAt = Date.now();
  const initialStat = await statDesktopTerminalSessionFile(sessionId).catch(() => null);

  if (pendingTerminalCloseGenerations.get(sessionId) !== generation) {
    return;
  }

  scheduleTerminalCloseWhenSessionFileIdle({
    sessionId,
    pollMs,
    maxKeepAliveMs,
    previousStat: initialStat,
    statusFailureCount: 0,
    startedAt,
    generation,
  });
}

function writeSystemMessage(write: (data: string) => void, message: string) {
  write(`\r\n[terminal] ${message}\r\n`);
}

function clearTerminal(write: (data: string) => void) {
  write(CLEAR_TERMINAL_SEQUENCE);
}

function clampTerminalHistory(history: string) {
  return history.length > MAX_FRONTEND_HISTORY_CHARS
    ? history.slice(-TRIMMED_FRONTEND_HISTORY_CHARS)
    : history;
}

function extractTerminalLinks(line: string): TerminalLinkMatch[] {
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

function findTerminalLinkAtPoint(container: HTMLElement, clientX: number, clientY: number) {
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

function hasSelectionInside(container: HTMLElement) {
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

function normalizeTerminalDimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function isUsableTerminalSize(cols: number, rows: number) {
  return cols >= MIN_USABLE_TERMINAL_COLS && rows >= MIN_USABLE_TERMINAL_ROWS;
}

function measureTerminalSize(terminal: WTerm) {
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

function terminalWrapperStyle(backgroundCssVar: TerminalBackgroundCssVar): CSSProperties {
  return {
    "--terminal-surface": `var(${backgroundCssVar})`,
  } as CSSProperties;
}

function terminalStyleVars(backgroundCssVar: TerminalBackgroundCssVar): CSSProperties {
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

function isTerminalElementNearBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.clientHeight - element.scrollTop <=
    TERMINAL_STICKY_BOTTOM_THRESHOLD_PX
  );
}

export function TerminalViewport({
  projectId,
  sessionPath,
  launchMode = "shell",
  onProcessExit,
  preserveSessionOnUnmount = false,
  keepAliveMsOnUnmount = 0,
  closeWhenSessionFileIdleMs = 0,
  maxKeepAliveMsOnUnmount = DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT,
  backgroundCssVar = "--terminal-bg",
  className,
}: TerminalViewportProps) {
  const terminalHandleRef = useRef<TerminalHandle | null>(null);
  const terminalInstanceRef = useRef<WTerm | null>(null);
  const pendingScrollFrameRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const attachFailedRef = useRef(false);
  const pendingEventsRef = useRef<TerminalEvent[]>([]);
  const replayingBufferedEventsRef = useRef(false);
  const terminalHistoryRef = useRef("");
  const lastKnownSizeRef = useRef({ cols: DEFAULT_TERMINAL_COLS, rows: DEFAULT_TERMINAL_ROWS });
  const lastSentSizeRef = useRef<{ sessionId: string; cols: number; rows: number } | null>(null);
  const [terminalReadyRevision, setTerminalReadyRevision] = useState(0);
  const [terminalInitError, setTerminalInitError] = useState<string | null>(null);
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  const effectiveLaunchMode =
    launchMode === "pi-session" && !persistedSessionPath ? "shell" : launchMode;
  const terminalSessionPath =
    effectiveLaunchMode === "pi-session" ? persistedSessionPath : sessionPath;
  const viewportStyle = useMemo(() => terminalWrapperStyle(backgroundCssVar), [backgroundCssVar]);
  const terminalStyle = useMemo(() => terminalStyleVars(backgroundCssVar), [backgroundCssVar]);

  const scrollTerminalToBottom = useCallback(() => {
    const terminalElement = terminalInstanceRef.current?.element;
    if (!terminalElement) {
      return;
    }

    terminalElement.scrollTop = terminalElement.scrollHeight;
  }, []);

  const scheduleTerminalScrollToBottom = useCallback(() => {
    if (pendingScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingScrollFrameRef.current);
    }

    pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollTerminalToBottom();
      pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollTerminalToBottom();
        pendingScrollFrameRef.current = null;
      });
    });
  }, [scrollTerminalToBottom]);

  const writeToTerminal = useCallback(
    (data: string | Uint8Array) => {
      const terminalElement = terminalInstanceRef.current?.element;
      const shouldStickToBottom = !terminalElement || isTerminalElementNearBottom(terminalElement);

      terminalHandleRef.current?.write(data);

      if (shouldStickToBottom) {
        scheduleTerminalScrollToBottom();
      }
    },
    [scheduleTerminalScrollToBottom],
  );

  useEffect(
    () => () => {
      if (pendingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingScrollFrameRef.current);
      }
    },
    [],
  );

  const resetTerminal = useCallback(
    (history = "") => {
      const nextHistory = clampTerminalHistory(history);
      terminalHistoryRef.current = nextHistory;
      clearTerminal((data) => writeToTerminal(data));
      if (nextHistory) {
        writeToTerminal(nextHistory);
      }
    },
    [writeToTerminal],
  );

  const appendTerminalHistory = useCallback(
    (chunk: string) => {
      const nextHistory = clampTerminalHistory(terminalHistoryRef.current + chunk);
      const trimmed = nextHistory.length !== terminalHistoryRef.current.length + chunk.length;
      terminalHistoryRef.current = nextHistory;

      if (trimmed) {
        clearTerminal((data) => writeToTerminal(data));
        if (nextHistory) {
          writeToTerminal(nextHistory);
        }
        return;
      }

      writeToTerminal(chunk);
    },
    [writeToTerminal],
  );

  const handleTerminalReady = useCallback((terminal: WTerm) => {
    terminalInstanceRef.current = terminal;
    setTerminalInitError(null);
    const measuredSize = measureTerminalSize(terminal);
    lastKnownSizeRef.current = {
      cols: normalizeTerminalDimension(measuredSize?.cols ?? terminal.cols, DEFAULT_TERMINAL_COLS),
      rows: normalizeTerminalDimension(measuredSize?.rows ?? terminal.rows, DEFAULT_TERMINAL_ROWS),
    };
    setTerminalReadyRevision((current) => current + 1);
  }, []);

  const handleTerminalError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unable to initialize terminal.";
    setTerminalInitError(message);
  }, []);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    const nextCols = normalizeTerminalDimension(cols, lastKnownSizeRef.current.cols);
    const nextRows = normalizeTerminalDimension(rows, lastKnownSizeRef.current.rows);

    if (!isUsableTerminalSize(nextCols, nextRows)) {
      return;
    }

    lastKnownSizeRef.current = {
      cols: nextCols,
      rows: nextRows,
    };

    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      return;
    }

    const nextSize = { sessionId, cols: nextCols, rows: nextRows };
    const lastSentSize = lastSentSizeRef.current;

    if (
      lastSentSize &&
      lastSentSize.sessionId === nextSize.sessionId &&
      lastSentSize.cols === nextSize.cols &&
      lastSentSize.rows === nextSize.rows
    ) {
      return;
    }

    lastSentSizeRef.current = nextSize;
    void resizeDesktopTerminal(nextSize);
  }, []);

  const handleTerminalData = useCallback(
    (data: string) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return;
      }

      void writeDesktopTerminal(sessionId, data).catch((error) => {
        writeSystemMessage(
          (message) => writeToTerminal(message),
          error instanceof Error ? error.message : "Terminal write failed.",
        );
      });
    },
    [writeToTerminal],
  );

  useEffect(() => {
    if (terminalReadyRevision === 0) {
      return;
    }

    const terminalElement = terminalInstanceRef.current?.element;
    if (!terminalElement) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (hasSelectionInside(terminalElement)) {
        return;
      }

      const match = findTerminalLinkAtPoint(terminalElement, event.clientX, event.clientY);
      if (!match) {
        return;
      }

      terminalHandleRef.current?.focus();
      event.preventDefault();

      void window.piDesktop?.openExternal?.(match.text).then((opened) => {
        if (!opened) {
          writeSystemMessage((message) => writeToTerminal(message), `Unable to open ${match.text}`);
        }
      });
    };

    terminalElement.addEventListener("click", handleClick, true);

    return () => {
      terminalElement.removeEventListener("click", handleClick, true);
    };
  }, [terminalReadyRevision, writeToTerminal]);

  useEffect(() => {
    if (terminalReadyRevision === 0) {
      return;
    }

    const terminal = terminalInstanceRef.current;
    if (!terminal) {
      return;
    }

    let cancelled = false;
    attachFailedRef.current = false;
    sessionIdRef.current = null;
    lastSentSizeRef.current = null;
    pendingEventsRef.current = [];
    replayingBufferedEventsRef.current = false;
    terminalHistoryRef.current = "";
    resetTerminal();

    const bufferPendingEvent = (event: TerminalEvent) => {
      pendingEventsRef.current.push(event);

      if (pendingEventsRef.current.length > MAX_PENDING_TERMINAL_EVENTS) {
        pendingEventsRef.current.splice(
          0,
          pendingEventsRef.current.length - MAX_PENDING_TERMINAL_EVENTS,
        );
      }
    };

    const applyTerminalEvent = (event: TerminalEvent) => {
      switch (event.type) {
        case "output":
          appendTerminalHistory(event.data);
          break;
        case "error":
          appendTerminalHistory(`\r\n[terminal] ${event.message}\r\n`);
          break;
        case "exited":
          appendTerminalHistory(
            `\r\n[terminal] Process exited${event.exitCode !== null ? ` (${event.exitCode})` : ""}.\r\n`,
          );
          onProcessExit?.();
          break;
        case "cleared":
          terminalHistoryRef.current = "";
          clearTerminal((message) => writeToTerminal(message));
          break;
        case "started":
        case "restarted":
          resetTerminal(event.snapshot.history);
          break;
      }
    };

    const replayBufferedEvents = (sessionId: string) => {
      replayingBufferedEventsRef.current = true;

      while (pendingEventsRef.current.length > 0) {
        const pendingEvents = pendingEventsRef.current.splice(0, pendingEventsRef.current.length);

        for (const event of pendingEvents) {
          if (event.sessionId !== sessionId) {
            continue;
          }

          applyTerminalEvent(event);
        }
      }

      replayingBufferedEventsRef.current = false;
    };

    const unsubscribe = subscribeDesktopTerminal((event: TerminalEvent) => {
      const sessionId = sessionIdRef.current;

      if (!sessionId || replayingBufferedEventsRef.current) {
        if (!attachFailedRef.current) {
          bufferPendingEvent(event);
        }
        return;
      }

      if (event.sessionId !== sessionId) {
        return;
      }

      applyTerminalEvent(event);
    });

    const getCurrentSize = () => {
      const measuredSize = measureTerminalSize(terminal);

      return {
        cols: normalizeTerminalDimension(
          measuredSize?.cols ?? terminal.cols,
          lastKnownSizeRef.current.cols,
        ),
        rows: normalizeTerminalDimension(
          measuredSize?.rows ?? terminal.rows,
          lastKnownSizeRef.current.rows,
        ),
      };
    };

    const openSession = async () => {
      const initialSize = getCurrentSize();
      const size = {
        cols: Math.max(initialSize.cols, MIN_INITIAL_TERMINAL_COLS),
        rows: Math.max(initialSize.rows, MIN_INITIAL_TERMINAL_ROWS),
      };
      const snapshot = await openDesktopTerminal({
        projectId,
        sessionPath: terminalSessionPath,
        launchMode: effectiveLaunchMode,
        cols: size.cols,
        rows: size.rows,
      });

      if (cancelled || !snapshot) {
        return;
      }

      attachFailedRef.current = false;
      sessionIdRef.current = snapshot.sessionId;
      lastSentSizeRef.current = {
        sessionId: snapshot.sessionId,
        cols: snapshot.cols,
        rows: snapshot.rows,
      };
      cancelScheduledTerminalClose(snapshot.sessionId);
      resetTerminal(snapshot.history);

      if (snapshot.status === "exited") {
        writeSystemMessage(
          (message) => writeToTerminal(message),
          `Process exited${snapshot.exitCode !== null ? ` (${snapshot.exitCode})` : ""}.`,
        );
      }

      replayBufferedEvents(snapshot.sessionId);
      terminalHandleRef.current?.focus();

      const resizedSize = getCurrentSize();
      if (resizedSize.cols !== snapshot.cols || resizedSize.rows !== snapshot.rows) {
        handleTerminalResize(resizedSize.cols, resizedSize.rows);
      }
    };

    void openSession().catch((error) => {
      attachFailedRef.current = true;
      pendingEventsRef.current = [];
      writeSystemMessage(
        (message) => writeToTerminal(message),
        error instanceof Error ? error.message : "Unable to open terminal.",
      );
    });

    return () => {
      cancelled = true;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      pendingEventsRef.current = [];
      replayingBufferedEventsRef.current = false;
      lastSentSizeRef.current = null;

      unsubscribe();

      if (!sessionId) {
        return;
      }

      const shouldCloseEmptyPreservedSession =
        preserveSessionOnUnmount &&
        effectiveLaunchMode === "shell" &&
        !hasVisibleTerminalHistory(terminalHistoryRef.current);

      if (!preserveSessionOnUnmount || shouldCloseEmptyPreservedSession) {
        if (
          !shouldCloseEmptyPreservedSession &&
          closeWhenSessionFileIdleMs > 0 &&
          persistedSessionPath
        ) {
          void scheduleTerminalCloseAfterSessionFileIdle(
            sessionId,
            closeWhenSessionFileIdleMs,
            maxKeepAliveMsOnUnmount,
          );
        } else if (!shouldCloseEmptyPreservedSession && keepAliveMsOnUnmount > 0) {
          scheduleTerminalClose(sessionId, keepAliveMsOnUnmount);
        } else {
          void closeDesktopTerminal({ sessionId, deleteHistory: shouldCloseEmptyPreservedSession });
        }
      }
    };
  }, [
    effectiveLaunchMode,
    appendTerminalHistory,
    closeWhenSessionFileIdleMs,
    handleTerminalResize,
    keepAliveMsOnUnmount,
    maxKeepAliveMsOnUnmount,
    onProcessExit,
    preserveSessionOnUnmount,
    persistedSessionPath,
    projectId,
    resetTerminal,
    terminalReadyRevision,
    terminalSessionPath,
    writeToTerminal,
  ]);

  return (
    <div
      style={viewportStyle}
      className={cn(
        "terminal-viewport relative h-full min-h-[220px] min-w-0 w-full flex-1 overflow-hidden rounded-[12px] bg-[color:var(--terminal-surface)] text-[color:var(--text)]",
        className,
      )}
    >
      <Terminal
        ref={terminalHandleRef}
        autoResize
        cursorBlink
        onReady={handleTerminalReady}
        onError={handleTerminalError}
        onResize={handleTerminalResize}
        onData={handleTerminalData}
        className="h-full w-full"
        style={{ height: "100%", width: "100%", ...terminalStyle }}
      />
      {terminalInitError ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start bg-[color:var(--terminal-surface)]/92 px-4 py-3 text-[12px] leading-5 text-[color:var(--text)]">
          <span>[terminal] {terminalInitError}</span>
        </div>
      ) : null}
    </div>
  );
}
