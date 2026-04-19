import { describe, expect, it } from "vitest";
import { makeSessionId } from "../../desktop/terminal/session-id";
import { resolveTerminalCommand } from "../../desktop/terminal/terminal-command.helpers";
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
});
