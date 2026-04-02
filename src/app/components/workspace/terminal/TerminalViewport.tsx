import { FitAddon } from "@xterm/addon-fit";
import { type ITheme, Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import type { TerminalEvent } from "../../../desktop/types";
import {
  closeDesktopTerminal,
  openDesktopTerminal,
  resizeDesktopTerminal,
  subscribeDesktopTerminal,
  writeDesktopTerminal,
} from "../../../hooks/useDesktopTerminal";

type TerminalViewportProps = {
  projectId: string;
  sessionPath: string | null;
  launchMode?: "shell" | "pi-session";
  preserveSessionOnUnmount?: boolean;
};

function writeSystemMessage(terminal: Terminal, message: string) {
  terminal.write(`\r\n[terminal] ${message}\r\n`);
}

function terminalThemeFromApp(): ITheme {
  const rootStyles = getComputedStyle(document.documentElement);
  return {
    background: rootStyles.getPropertyValue("--workspace").trim() || "#1f2230",
    foreground: rootStyles.getPropertyValue("--text").trim() || "#d5daed",
    cursor: "#b9bff3",
    selectionBackground: "rgba(185, 191, 243, 0.18)",
    scrollbarSliderBackground: "rgba(255, 255, 255, 0.08)",
    scrollbarSliderHoverBackground: "rgba(255, 255, 255, 0.14)",
    scrollbarSliderActiveBackground: "rgba(255, 255, 255, 0.2)",
    black: "#1f2230",
    red: "#d06b72",
    green: "#86d9a0",
    yellow: "#d8b46a",
    blue: "#93b7ff",
    magenta: "#c4a4ff",
    cyan: "#7fdae0",
    white: "#d5daed",
    brightBlack: "#727894",
    brightRed: "#e88b93",
    brightGreen: "#9beab2",
    brightYellow: "#e7ca88",
    brightBlue: "#abc6ff",
    brightMagenta: "#d7bcff",
    brightCyan: "#9ce8ed",
    brightWhite: "#f4f7ff",
  };
}

function extractTerminalLinks(line: string) {
  const matches = [...line.matchAll(/https?:\/\/[^\s)\]}]+/g)];
  return matches.map((match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

export function TerminalViewport({
  projectId,
  sessionPath,
  launchMode = "shell",
  preserveSessionOnUnmount = false,
}: TerminalViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const lastSizeRef = useRef<{ width: number; height: number; cols: number; rows: number } | null>(
    null,
  );

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount) {
      return;
    }

    let cancelled = false;
    const fitAddon = new FitAddon();
    const terminal = new Terminal({
      cursorBlink: true,
      lineHeight: 1.2,
      fontSize: 12,
      scrollback: 5_000,
      fontFamily: '"SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      theme: terminalThemeFromApp(),
    });

    terminal.loadAddon(fitAddon);
    terminal.open(mount);
    fitAddon.fit();
    terminal.focus();
    lastSizeRef.current = {
      width: mount.clientWidth,
      height: mount.clientHeight,
      cols: terminal.cols,
      rows: terminal.rows,
    };

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const linkDisposable = terminal.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const activeTerminal = terminalRef.current;
        if (!activeTerminal) {
          callback(undefined);
          return;
        }

        const line = activeTerminal.buffer.active.getLine(bufferLineNumber - 1);
        if (!line) {
          callback(undefined);
          return;
        }

        const lineText = line.translateToString(true);
        const matches = extractTerminalLinks(lineText);
        if (!matches.length) {
          callback(undefined);
          return;
        }

        callback(
          matches.map((match) => ({
            text: match.text,
            range: {
              start: { x: match.start + 1, y: bufferLineNumber },
              end: { x: match.end, y: bufferLineNumber },
            },
            activate: () => {
              void window.piDesktop?.openExternal?.(match.text).then((opened) => {
                if (!opened) {
                  writeSystemMessage(activeTerminal, `Unable to open ${match.text}`);
                }
              });
            },
          })),
        );
      },
    });

    const inputDisposable = terminal.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return;
      }

      void writeDesktopTerminal(sessionId, data).catch((error) => {
        writeSystemMessage(
          terminal,
          error instanceof Error ? error.message : "Terminal write failed.",
        );
      });
    });

    const unsubscribe = subscribeDesktopTerminal((event: TerminalEvent) => {
      if (event.sessionId !== sessionIdRef.current) {
        return;
      }

      switch (event.type) {
        case "output":
          terminal.write(event.data);
          break;
        case "error":
          writeSystemMessage(terminal, event.message);
          break;
        case "exited":
          writeSystemMessage(
            terminal,
            `Process exited${event.exitCode !== null ? ` (${event.exitCode})` : ""}.`,
          );
          break;
        case "cleared":
          terminal.clear();
          break;
        case "started":
        case "restarted":
          terminal.clear();
          if (event.snapshot.history) {
            terminal.write(event.snapshot.history);
          }
          break;
      }
    });

    const themeObserver = new MutationObserver(() => {
      terminal.options.theme = terminalThemeFromApp();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    const resizeObserver = new ResizeObserver(() => {
      const activeTerminal = terminalRef.current;
      const activeFitAddon = fitAddonRef.current;
      const sessionId = sessionIdRef.current;
      if (!activeTerminal || !activeFitAddon || !sessionId) {
        return;
      }

      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (width <= 0 || height <= 0) {
        return;
      }

      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;

        activeFitAddon.fit();

        const previousSize = lastSizeRef.current;
        const nextSize = {
          width,
          height,
          cols: activeTerminal.cols,
          rows: activeTerminal.rows,
        };

        const changed =
          !previousSize ||
          previousSize.width !== nextSize.width ||
          previousSize.height !== nextSize.height ||
          previousSize.cols !== nextSize.cols ||
          previousSize.rows !== nextSize.rows;

        lastSizeRef.current = nextSize;

        if (!changed) {
          return;
        }

        void resizeDesktopTerminal({
          sessionId,
          cols: activeTerminal.cols,
          rows: activeTerminal.rows,
        });
      });
    });

    resizeObserver.observe(mount);

    const openSession = async () => {
      fitAddon.fit();
      const snapshot = await openDesktopTerminal({
        projectId,
        sessionPath,
        launchMode,
        cols: Math.max(terminal.cols, 20),
        rows: Math.max(terminal.rows, 5),
      });

      if (cancelled || !snapshot) {
        return;
      }

      sessionIdRef.current = snapshot.sessionId;
      terminal.clear();
      if (snapshot.history) {
        terminal.write(snapshot.history);
      }

      if (snapshot.status === "exited") {
        writeSystemMessage(
          terminal,
          `Process exited${snapshot.exitCode !== null ? ` (${snapshot.exitCode})` : ""}.`,
        );
      }
    };

    void openSession().catch((error) => {
      writeSystemMessage(
        terminal,
        error instanceof Error ? error.message : "Unable to open terminal.",
      );
    });

    return () => {
      cancelled = true;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      resizeObserver.disconnect();
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      themeObserver.disconnect();
      unsubscribe();
      inputDisposable.dispose();
      linkDisposable.dispose();
      terminal.dispose();

      if (sessionId && !preserveSessionOnUnmount) {
        void closeDesktopTerminal({ sessionId });
      }
    };
  }, [launchMode, preserveSessionOnUnmount, projectId, sessionPath]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[220px] min-w-0 w-full flex-1 overflow-hidden rounded-[12px]"
    />
  );
}
