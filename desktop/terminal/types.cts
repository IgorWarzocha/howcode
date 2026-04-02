export type PtyExitEvent = {
  exitCode: number;
  signal: number | null;
};

export type PtySpawnInput = {
  shell: string;
  args?: string[];
  cwd: string;
  cols: number;
  rows: number;
  env: NodeJS.ProcessEnv;
};

export interface PtyProcess {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(callback: (data: string) => void): () => void;
  onExit(callback: (event: PtyExitEvent) => void): () => void;
}

export interface PtyAdapter {
  readonly name: string;
  spawn(input: PtySpawnInput): Promise<PtyProcess>;
}
