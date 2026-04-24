import { spawn } from "node:child_process";
import process from "node:process";

function getOpenCommand() {
  if (process.platform === "darwin") {
    return { command: "open", args: [] };
  }

  if (process.platform === "win32") {
    return { command: "rundll32.exe", args: ["url.dll,FileProtocolHandler"] };
  }

  return { command: "xdg-open", args: [] };
}

export async function openPathWithSystem(targetPath: string) {
  const { command, args } = getOpenCommand();

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const child = spawn(command, [...args, targetPath], {
      stdio: "ignore",
      windowsHide: true,
    });

    const finish = (ok: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(ok);
    };

    child.once("error", () => {
      finish(false);
    });
    child.once("exit", (code) => {
      finish(code === 0);
    });

    setTimeout(() => {
      child.kill();
      finish(false);
    }, 10_000).unref();
  });
}
