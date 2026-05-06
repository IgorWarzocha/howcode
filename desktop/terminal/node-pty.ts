import type { PtyAdapter, PtyExitEvent, PtyProcess, PtySpawnInput } from './types.ts'

class NodePtyProcess implements PtyProcess {
  private readonly process: import('node-pty').IPty

  constructor(process: import('node-pty').IPty) {
    this.process = process
  }

  get pid() {
    return this.process.pid
  }

  write(data: string) {
    this.process.write(data)
  }

  resize(cols: number, rows: number) {
    this.process.resize(cols, rows)
  }

  kill(signal?: string | undefined) {
    this.process.kill(signal)
  }

  onData(callback: (data: string) => void) {
    const disposable = this.process.onData(callback)
    return () => {
      disposable.dispose()
    }
  }

  onExit(callback: (event: PtyExitEvent) => void) {
    const disposable = this.process.onExit((event) => {
      callback({ exitCode: event.exitCode, signal: event.signal ?? null })
    })

    return () => {
      disposable.dispose()
    }
  }
}

export const nodePtyAdapter: PtyAdapter = {
  name: 'node-pty',
  async spawn(input: PtySpawnInput) {
    const nodePty = await import('node-pty')
    const processHandle = nodePty.spawn(input.shell, input.args ?? [], {
      cwd: input.cwd,
      cols: input.cols,
      rows: input.rows,
      env: input.env,
      name: process.platform === 'win32' ? 'xterm-color' : 'xterm-256color',
    })

    return new NodePtyProcess(processHandle)
  },
}
