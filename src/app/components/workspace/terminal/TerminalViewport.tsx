import { GhosttyCore } from "@wterm/ghostty";
import { Terminal, type TerminalCore, type TerminalHandle, type WTerm } from "@wterm/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  cancelScheduledTerminalClose,
  scheduleTerminalClose,
  scheduleTerminalCloseAfterSessionFileIdle,
} from "./terminalViewportSessionLifecycle";
import {
  DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT,
  DEFAULT_TERMINAL_COLS,
  DEFAULT_TERMINAL_ROWS,
  MAX_PENDING_TERMINAL_EVENTS,
  MIN_INITIAL_TERMINAL_COLS,
  MIN_INITIAL_TERMINAL_ROWS,
  clampTerminalHistory,
  clearTerminal,
  findTerminalLinkAtPoint,
  hasSelectionInside,
  hasVisibleTerminalHistory,
  isTerminalElementNearBottom,
  isUsableTerminalSize,
  measureTerminalSize,
  normalizeTerminalDimension,
  terminalStyleVars,
  terminalWrapperStyle,
  type TerminalBackgroundCssVar,
  writeSystemMessage,
} from "./terminalViewportUtils";

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

async function loadUsableGhosttyCore() {
  const probe = await GhosttyCore.load({ scrollbackLimit: 100 });
  probe.init(20, 5);
  for (let line = 1; line <= 8; line += 1) {
    probe.writeString(`ghostty-scrollback-probe-${line}\r\n`);
  }

  const scrollbackCount = probe.getScrollbackCount();
  const hasReadableScrollback =
    scrollbackCount === 0 ||
    Array.from({ length: scrollbackCount }, (_, offset) => probe.getScrollbackLineLen(offset)).some(
      (lineLength) => lineLength > 0,
    );

  if (!hasReadableScrollback) {
    return null;
  }

  return GhosttyCore.load();
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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const terminalHandleRef = useRef<TerminalHandle | null>(null);
  const terminalInstanceRef = useRef<WTerm | null>(null);
  const terminalResizeFrameRef = useRef<number | null>(null);
  const pendingScrollFrameRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const attachFailedRef = useRef(false);
  const pendingEventsRef = useRef<TerminalEvent[]>([]);
  const replayingBufferedEventsRef = useRef(false);
  const terminalHistoryRef = useRef("");
  const piSessionPathRef = useRef<{ value: string | null } | null>(null);
  const lastKnownSizeRef = useRef({ cols: DEFAULT_TERMINAL_COLS, rows: DEFAULT_TERMINAL_ROWS });
  const lastSentSizeRef = useRef<{ sessionId: string; cols: number; rows: number } | null>(null);
  const [terminalReadyRevision, setTerminalReadyRevision] = useState(0);
  const [terminalInitError, setTerminalInitError] = useState<string | null>(null);
  const [terminalCore, setTerminalCore] = useState<TerminalCore | null | undefined>(undefined);
  const effectiveLaunchMode = launchMode;
  if (effectiveLaunchMode === "pi-session" && piSessionPathRef.current === null) {
    piSessionPathRef.current = { value: sessionPath };
  }
  const terminalSessionPath =
    effectiveLaunchMode === "pi-session" ? piSessionPathRef.current?.value : sessionPath;
  const terminalPersistedSessionPath =
    getPersistedSessionPath(terminalSessionPath) ??
    (effectiveLaunchMode === "pi-session" ? getPersistedSessionPath(sessionPath) : null);
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
      if (terminalResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(terminalResizeFrameRef.current);
      }
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

  useEffect(() => {
    let cancelled = false;
    setTerminalCore(undefined);
    setTerminalInitError(null);

    void loadUsableGhosttyCore().then(
      (core) => {
        if (!cancelled) {
          setTerminalCore(core);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to initialize terminal.";
          setTerminalInitError(message);
        }
      },
    );

    return () => {
      cancelled = true;
    };
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

  const resizeTerminalToContainer = useCallback(() => {
    const terminal = terminalInstanceRef.current;
    const terminalElement = terminal?.element;
    if (!terminal || !terminalElement) {
      return;
    }

    const shouldStickToBottom = isTerminalElementNearBottom(terminalElement);
    const measuredSize = measureTerminalSize(terminal);
    if (!measuredSize) {
      return;
    }

    const cols = normalizeTerminalDimension(measuredSize.cols, lastKnownSizeRef.current.cols);
    const rows = normalizeTerminalDimension(measuredSize.rows, lastKnownSizeRef.current.rows);
    if (!isUsableTerminalSize(cols, rows)) {
      return;
    }

    if (terminal.cols !== cols || terminal.rows !== rows) {
      terminal.resize(cols, rows);
    }
    handleTerminalResize(cols, rows);

    if (shouldStickToBottom) {
      scheduleTerminalScrollToBottom();
    }
  }, [handleTerminalResize, scheduleTerminalScrollToBottom]);

  const scheduleTerminalResizeToContainer = useCallback(() => {
    if (terminalResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(terminalResizeFrameRef.current);
    }

    terminalResizeFrameRef.current = window.requestAnimationFrame(() => {
      terminalResizeFrameRef.current = null;
      resizeTerminalToContainer();
    });
  }, [resizeTerminalToContainer]);

  useEffect(() => {
    if (terminalReadyRevision === 0) {
      return;
    }

    const viewportElement = viewportRef.current;
    if (!viewportElement || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      scheduleTerminalResizeToContainer();
    });

    observer.observe(viewportElement);
    scheduleTerminalResizeToContainer();

    return () => {
      observer.disconnect();
      if (terminalResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(terminalResizeFrameRef.current);
        terminalResizeFrameRef.current = null;
      }
    };
  }, [scheduleTerminalResizeToContainer, terminalReadyRevision]);

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
          terminalPersistedSessionPath
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
    terminalPersistedSessionPath,
    projectId,
    resetTerminal,
    terminalReadyRevision,
    terminalSessionPath,
    writeToTerminal,
  ]);

  return (
    <div
      ref={viewportRef}
      style={viewportStyle}
      className={cn(
        "terminal-viewport relative h-full min-h-[220px] min-w-0 w-full flex-1 overflow-hidden rounded-[12px] bg-[color:var(--terminal-surface)] text-[color:var(--text)]",
        className,
      )}
    >
      {terminalCore !== undefined ? (
        <Terminal
          ref={terminalHandleRef}
          core={terminalCore ?? undefined}
          autoResize
          cursorBlink
          onReady={handleTerminalReady}
          onError={handleTerminalError}
          onResize={handleTerminalResize}
          onData={handleTerminalData}
          className="h-full w-full"
          style={{ height: "100%", width: "100%", ...terminalStyle }}
        />
      ) : null}
      {terminalCore === undefined && !terminalInitError ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start bg-[color:var(--terminal-surface)] px-4 py-3 text-[12px] leading-5 text-[color:var(--muted)]">
          <span>[terminal] Loading Ghostty renderer…</span>
        </div>
      ) : null}
      {terminalInitError ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start bg-[color:var(--terminal-surface)]/92 px-4 py-3 text-[12px] leading-5 text-[color:var(--text)]">
          <span>[terminal] {terminalInitError}</span>
        </div>
      ) : null}
    </div>
  );
}
