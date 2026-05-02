import { spawn } from "node:child_process";
import path from "node:path";

export function spawnDetached(executablePath: string) {
  const env = { ...process.env };
  Reflect.deleteProperty(env, "NODE_TLS_REJECT_UNAUTHORIZED");

  return new Promise<void>((resolve, reject) => {
    const child = spawn(executablePath, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      cwd: path.dirname(executablePath),
      env,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
