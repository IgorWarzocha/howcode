import { Terminal, type TerminalHandle, type WTerm } from "@wterm/react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPersistedSessionPath } from "../../../../../shared/session-paths";
import type { TerminalEvent } from "../../../desktop/types";
import {
  closeDesktopTerminal,
  openDesktopTerminal,
  resizeDesktopTerminal,
  subscribeDesktopTerminal,
  writeDesktopTerminal,
} from "../../../hooks/useDesktopTerminal";
import { cn } from "../../../utils/cn";

type TerminalBackgroundCssVar = "--terminal-bg" | "--workspace" | "--sidebar";

type TerminalViewportProps = {
  projectId: string;
  sessionPath: string | null;
  launchMode?: "shell" | "pi-session";
  preserveSessionOnUnmount?: boolean;
  keepAliveMsOnUnmount?: number;
  backgroundCssVar?: TerminalBackgroundCssVar;
  className?: string;
};

type TerminalLinkMatch = {
  text: string;
  start: number;
  end: number;
};

const pendingTerminalCloseTimers = new Map<string, ReturnType<typeof setTimeout>>();

const CLEAR_TERMINAL_SEQUENCE = "\u001b[2J\u001b[3J\u001b[H";
const MAX_PENDING_TERMINAL_EVENTS = 200;
const MIN_TERMINAL_COLS = 20;
const MIN_TERMINAL_ROWS = 5;
const TERMINAL_LINK_PATTERN = /https?:\/\/[^\s)\]}]+/g;

function cancelScheduledTerminalClose(sessionId: string) {
  const timer = pendingTerminalCloseTimers.get(sessionId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  pendingTerminalCloseTimers.delete(sessionId);
}

function scheduleTerminalClose(sessionId: string, delayMs: number) {
  cancelScheduledTerminalClose(sessionId);

  const timer = setTimeout(() => {
    pendingTerminalCloseTimers.delete(sessionId);
    void closeDesktopTerminal({ sessionId });
  }, delayMs);

  pendingTerminalCloseTimers.set(sessionId, timer);
}

function writeSystemMessage(write: (data: string) => void, message: string) {
  write(`\r\n[terminal] ${message}\r\n`);
}

function clearTerminal(write: (data: string) => void) {
  write(CLEAR_TERMINAL_SEQUENCE);
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
      (match) => rowTextOffset >= match.start && rowTextOffset <= match.end,
    ) ?? null
  );
}

function terminalStyleVars(backgroundCssVar: TerminalBackgroundCssVar): CSSProperties {
  return {
    "--terminal-surface": `var(${backgroundCssVar})`,
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

export function TerminalViewport({
  projectId,
  sessionPath,
  launchMode = "shell",
  preserveSessionOnUnmount = false,
  keepAliveMsOnUnmount = 0,
  backgroundCssVar = "--terminal-bg",
  className,
}: TerminalViewportProps) {
  const terminalHandleRef = useRef<TerminalHandle | null>(null);
  const terminalInstanceRef = useRef<WTerm | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const attachFailedRef = useRef(false);
  const pendingEventsRef = useRef<TerminalEvent[]>([]);
  const replayingBufferedEventsRef = useRef(false);
  const openFrameRef = useRef<number | null>(null);
  const lastKnownSizeRef = useRef({ cols: 80, rows: 24 });
  const lastSentSizeRef = useRef<{ sessionId: string; cols: number; rows: number } | null>(null);
  const [terminalReadyRevision, setTerminalReadyRevision] = useState(0);
  const persistedSessionPath = getPersistedSessionPath(sessionPath);
  const effectiveLaunchMode =
    launchMode === "pi-session" && !persistedSessionPath ? "shell" : launchMode;
  const terminalSessionPath =
    effectiveLaunchMode === "pi-session" ? persistedSessionPath : sessionPath;
  const viewportStyle = useMemo(() => terminalStyleVars(backgroundCssVar), [backgroundCssVar]);

  const writeToTerminal = useCallback((data: string | Uint8Array) => {
    terminalHandleRef.current?.write(data);
  }, []);

  const resetTerminal = useCallback(
    (history = "") => {
      clearTerminal((data) => writeToTerminal(data));
      if (history) {
        writeToTerminal(history);
      }
    },
    [writeToTerminal],
  );

  const handleTerminalReady = useCallback((terminal: WTerm) => {
    terminalInstanceRef.current = terminal;
    lastKnownSizeRef.current = {
      cols: Math.max(terminal.cols, MIN_TERMINAL_COLS),
      rows: Math.max(terminal.rows, MIN_TERMINAL_ROWS),
    };
    setTerminalReadyRevision((current) => current + 1);
  }, []);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    const nextCols = Math.max(cols, MIN_TERMINAL_COLS);
    const nextRows = Math.max(rows, MIN_TERMINAL_ROWS);

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

    const setLinkHover = (hovered: boolean) => {
      terminalElement.dataset.linkHovered = hovered ? "true" : "false";
    };

    const handleMouseMove = (event: MouseEvent) => {
      setLinkHover(Boolean(findTerminalLinkAtPoint(terminalElement, event.clientX, event.clientY)));
    };

    const handleMouseLeave = () => {
      setLinkHover(false);
    };

    const handleClick = (event: MouseEvent) => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }

      const match = findTerminalLinkAtPoint(terminalElement, event.clientX, event.clientY);
      if (!match) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      void window.piDesktop?.openExternal?.(match.text).then((opened) => {
        if (!opened) {
          writeSystemMessage((message) => writeToTerminal(message), `Unable to open ${match.text}`);
        }
      });
    };

    terminalElement.addEventListener("mousemove", handleMouseMove);
    terminalElement.addEventListener("mouseleave", handleMouseLeave);
    terminalElement.addEventListener("click", handleClick, true);

    return () => {
      terminalElement.removeEventListener("mousemove", handleMouseMove);
      terminalElement.removeEventListener("mouseleave", handleMouseLeave);
      terminalElement.removeEventListener("click", handleClick, true);
      delete terminalElement.dataset.linkHovered;
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
          writeToTerminal(event.data);
          break;
        case "error":
          writeSystemMessage((message) => writeToTerminal(message), event.message);
          break;
        case "exited":
          writeSystemMessage(
            (message) => writeToTerminal(message),
            `Process exited${event.exitCode !== null ? ` (${event.exitCode})` : ""}.`,
          );
          break;
        case "cleared":
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

    const getCurrentSize = () => ({
      cols: Math.max(terminal.cols, lastKnownSizeRef.current.cols, MIN_TERMINAL_COLS),
      rows: Math.max(terminal.rows, lastKnownSizeRef.current.rows, MIN_TERMINAL_ROWS),
    });

    const openSession = async () => {
      const size = getCurrentSize();
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

      const currentSize = getCurrentSize();
      if (currentSize.cols !== snapshot.cols || currentSize.rows !== snapshot.rows) {
        handleTerminalResize(currentSize.cols, currentSize.rows);
      }
    };

    openFrameRef.current = requestAnimationFrame(() => {
      openFrameRef.current = null;

      void openSession().catch((error) => {
        attachFailedRef.current = true;
        pendingEventsRef.current = [];
        writeSystemMessage(
          (message) => writeToTerminal(message),
          error instanceof Error ? error.message : "Unable to open terminal.",
        );
      });
    });

    return () => {
      cancelled = true;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      pendingEventsRef.current = [];
      replayingBufferedEventsRef.current = false;
      lastSentSizeRef.current = null;

      if (openFrameRef.current !== null) {
        cancelAnimationFrame(openFrameRef.current);
        openFrameRef.current = null;
      }

      unsubscribe();

      if (sessionId && !preserveSessionOnUnmount) {
        if (keepAliveMsOnUnmount > 0) {
          scheduleTerminalClose(sessionId, keepAliveMsOnUnmount);
        } else {
          void closeDesktopTerminal({ sessionId });
        }
      }
    };
  }, [
    effectiveLaunchMode,
    handleTerminalResize,
    keepAliveMsOnUnmount,
    preserveSessionOnUnmount,
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
        "terminal-viewport h-full min-h-[220px] min-w-0 w-full flex-1 overflow-hidden rounded-[12px] bg-[color:var(--terminal-surface)] text-[color:var(--text)]",
        className,
      )}
    >
      <Terminal
        ref={terminalHandleRef}
        autoResize
        cursorBlink
        onReady={handleTerminalReady}
        onResize={handleTerminalResize}
        onData={handleTerminalData}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
