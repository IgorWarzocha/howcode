import { spawn } from "node:child_process";
import path from "node:path";

export function spawnDetached(executablePath: string) {
  const env = { ...process.env };
  Reflect.deleteProperty(env, "NODE_TLS_REJECT_UNAUTHORIZED");

  const child = spawn(executablePath, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    cwd: path.dirname(executablePath),
    env,
  });

  child.unref();
}
