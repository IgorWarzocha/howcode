import type { PtyAdapter, PtyExitEvent, PtyProcess, PtySpawnInput } from "./types";

class BunPtyProcess implements PtyProcess {
  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly exitListeners = new Set<(event: PtyExitEvent) => void>();
  private readonly decoder = new TextDecoder();
  private didExit = false;

  constructor(private readonly process: Bun.Subprocess) {
    void this.process.exited
      .then((exitCode) => {
        this.emitExit({
          exitCode: Number.isInteger(exitCode) ? exitCode : 0,
          signal: typeof this.process.signalCode === "number" ? this.process.signalCode : null,
        });
      })
      .catch(() => {
        this.emitExit({ exitCode: 1, signal: null });
      });
  }

  get pid() {
    return this.process.pid;
  }

  write(data: string) {
    this.process.terminal?.write(data);
  }

  resize(cols: number, rows: number) {
    this.process.terminal?.resize?.(cols, rows);
  }

  kill(signal?: string) {
    if (signal) {
      this.process.kill(signal as NodeJS.Signals);
      return;
    }

    this.process.kill();
  }

  onData(callback: (data: string) => void) {
    this.dataListeners.add(callback);
    return () => {
      this.dataListeners.delete(callback);
    };
  }

  onExit(callback: (event: PtyExitEvent) => void) {
    this.exitListeners.add(callback);
    return () => {
      this.exitListeners.delete(callback);
    };
  }

  emitData(data: Uint8Array) {
    if (this.didExit) {
      return;
    }

    const text = this.decoder.decode(data, { stream: true });
    if (!text.length) {
      return;
    }

    for (const listener of this.dataListeners) {
      listener(text);
    }
  }

  private emitExit(event: PtyExitEvent) {
    if (this.didExit) {
      return;
    }

    this.didExit = true;
    const remainder = this.decoder.decode();
    if (remainder.length > 0) {
      for (const listener of this.dataListeners) {
        listener(remainder);
      }
    }

    for (const listener of this.exitListeners) {
      listener(event);
    }
  }
}

export const bunPtyAdapter: PtyAdapter = {
  name: "bun",
  async spawn(input: PtySpawnInput) {
    if (!globalThis.Bun) {
      throw new Error("Bun runtime is unavailable for PTY spawning.");
    }

    if (process.platform === "win32") {
      throw new Error("Bun PTY terminal support is unavailable on Windows.");
    }

    let processHandle: BunPtyProcess | null = null;
    const subprocess = Bun.spawn([input.shell, ...(input.args ?? [])], {
      cwd: input.cwd,
      env: input.env,
      terminal: {
        cols: input.cols,
        rows: input.rows,
        data: (_terminal, data) => {
          processHandle?.emitData(data);
        },
      },
    });

    processHandle = new BunPtyProcess(subprocess);
    return processHandle;
  },
};
