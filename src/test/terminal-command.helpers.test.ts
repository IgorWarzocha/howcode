import { describe, expect, it } from "vitest";
import { makeSessionId } from "../../desktop/terminal/session-id";
import {
  resolveTerminalCommand,
  resolveTerminalEnv,
} from "../../desktop/terminal/terminal-command.helpers";
import type { TerminalOpenRequest } from "../../shared/terminal-contracts";

describe("terminal command helpers", () => {
  it("builds stable session ids and resolves platform-specific commands", () => {
    const request: TerminalOpenRequest = {
      projectId: "/repo",
      sessionPath: "/repo/.pi/session.json",
      cwd: "/repo",
      launchMode: "pi-session",
      cols: 120,
      rows: 40,
    };

    expect(makeSessionId(request)).toBe(makeSessionId({ ...request, cols: 80, rows: 24 }));
    expect(makeSessionId(request)).not.toBe(makeSessionId({ ...request, launchMode: "shell" }));
    expect(
      makeSessionId({
        projectId: "/repo",
        sessionPath: null,
        cwd: "/repo",
        launchMode: "pi-session",
        cols: 80,
        rows: 24,
      }),
    ).not.toBe(
      makeSessionId({
        projectId: "/repo",
        sessionPath: null,
        cwd: "/repo",
        launchMode: "shell",
        cols: 80,
        rows: 24,
      }),
    );
    expect(
      makeSessionId({
        projectId: "/repo",
        sessionPath: "local://%2Frepo/first",
        cwd: "/repo",
        launchMode: "pi-session",
        cols: 80,
        rows: 24,
      }),
    ).not.toBe(
      makeSessionId({
        projectId: "/repo",
        sessionPath: "local://%2Frepo/second",
        cwd: "/repo",
        launchMode: "pi-session",
        cols: 80,
        rows: 24,
      }),
    );

    expect(
      resolveTerminalCommand(
        {
          projectId: "/repo",
          sessionPath: "/repo/session.json",
          launchMode: "pi-session",
          cols: 80,
          rows: 24,
        },
        { platform: "linux", env: { PATH: "" } as NodeJS.ProcessEnv },
      ),
    ).toEqual({ shell: "pi", args: ["--session", "/repo/session.json"] });

    expect(
      resolveTerminalCommand(
        {
          projectId: "/repo",
          sessionPath: "local://%2Frepo/first",
          launchMode: "pi-session",
          cols: 80,
          rows: 24,
        },
        { platform: "linux", env: { PATH: "" } as NodeJS.ProcessEnv },
      ),
    ).toEqual({ shell: "pi", args: [] });

    expect(
      resolveTerminalCommand(
        {
          projectId: "C:/repo",
          launchMode: "shell",
          cols: 80,
          rows: 24,
        },
        {
          platform: "win32",
          env: { COMSPEC: "C:/Windows/System32/cmd.exe" } as NodeJS.ProcessEnv,
        },
      ),
    ).toEqual({ shell: "C:/Windows/System32/cmd.exe", args: [] });
  });

  it("scrubs host image-capability env from embedded Pi TUI sessions", () => {
    const env = resolveTerminalEnv(
      {
        projectId: "/repo",
        sessionPath: "local://%2Frepo/first",
        launchMode: "pi-session",
        cols: 80,
        rows: 24,
      },
      {
        TERM: "xterm-ghostty",
        TERM_PROGRAM: "ghostty",
        GHOSTTY_RESOURCES_DIR: "/usr/share/ghostty",
        KITTY_WINDOW_ID: "1",
        WEZTERM_PANE: "2",
        ITERM_SESSION_ID: "3",
      } as NodeJS.ProcessEnv,
    );

    expect(env.TERM).toBe("xterm-256color");
    expect(env.TERM_PROGRAM).toBe("howcode");
    expect(env.GHOSTTY_RESOURCES_DIR).toBeUndefined();
    expect(env.KITTY_WINDOW_ID).toBeUndefined();
    expect(env.WEZTERM_PANE).toBeUndefined();
    expect(env.ITERM_SESSION_ID).toBeUndefined();
    expect(env.HOWCODE_EMBEDDED_TERMINAL).toBe("1");
    expect(env.PI_CLEAR_ON_SHRINK).toBe("1");
  });
});
