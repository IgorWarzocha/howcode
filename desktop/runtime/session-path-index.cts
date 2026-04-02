const sessionPathToCwd = new Map<string, string>();

export function rememberSessionPath(sessionPath: string | null | undefined, cwd: string) {
  if (sessionPath) {
    sessionPathToCwd.set(sessionPath, cwd);
  }
}

export function getMappedCwd(sessionPath: string) {
  return sessionPathToCwd.get(sessionPath) ?? null;
}
