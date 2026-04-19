import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type NodeError = Error & {
  code?: string;
};

function getElectronInstallScriptPath() {
  return require.resolve("electron/install.js");
}

function tryResolveElectronBinary() {
  try {
    return require("electron") as string;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Electron failed to install correctly") ||
        ((error as NodeError).code === "MODULE_NOT_FOUND" &&
          /['\"]electron['\"]/.test(error.message)))
    ) {
      return null;
    }

    throw error;
  }
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${command} exited with signal ${signal}`
            : `${command} exited with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}

export async function ensureElectronBinary() {
  const binaryPath = tryResolveElectronBinary();
  if (binaryPath) {
    return binaryPath;
  }

  console.log("Electron binary missing; installing Electron runtime...");
  await runCommand("node", [getElectronInstallScriptPath()]);

  const resolvedBinaryPath = tryResolveElectronBinary();
  if (!resolvedBinaryPath) {
    throw new Error("Electron binary is still unavailable after installation.");
  }

  return resolvedBinaryPath;
}
