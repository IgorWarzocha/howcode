import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let cachedNodeExecutable: string | null = null;

export function getRuntimeHostPath() {
  const siblingWorkerPath = fileURLToPath(new URL("./worker.mjs", import.meta.url));
  if (existsSync(siblingWorkerPath)) return siblingWorkerPath;

  const bundledBridgeWorkerPath = fileURLToPath(new URL("./desktop/worker.mjs", import.meta.url));
  if (existsSync(bundledBridgeWorkerPath)) return bundledBridgeWorkerPath;

  return path.join(process.cwd(), "build", "desktop", "worker.mjs");
}

function isExecutableFile(filePath: string) {
  try {
    if (!statSync(filePath).isFile()) return false;
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function runShellNodeProbe(shell: string) {
  return new Promise<string | null>((resolve) => {
    const child = spawn(shell, ["-lc", "command -v node"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 2_000);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", () => {
      clearTimeout(timeout);
      resolve(null);
    });
    child.once("exit", () => {
      clearTimeout(timeout);
      const candidate = output.trim().split("\n")[0];
      resolve(
        candidate && path.isAbsolute(candidate) && isExecutableFile(candidate) ? candidate : null,
      );
    });
  });
}

async function discoverNodeFromShell() {
  const shells = [process.env.SHELL, "/bin/bash", "/bin/zsh", "/bin/sh"].filter(
    (shell): shell is string => Boolean(shell),
  );
  for (const shell of [...new Set(shells)]) {
    if (!isExecutableFile(shell)) continue;
    const candidate = await runShellNodeProbe(shell);
    if (candidate) return candidate;
  }
  return null;
}

export async function getNodeExecutable() {
  if (cachedNodeExecutable) return cachedNodeExecutable;

  for (const candidate of [process.env.HOWCODE_NODE_PATH, process.env.NODE]) {
    const normalized = candidate?.trim();
    if (normalized && isExecutableFile(normalized)) {
      cachedNodeExecutable = normalized;
      return cachedNodeExecutable;
    }
  }

  const shellNode = await discoverNodeFromShell();
  if (shellNode) {
    cachedNodeExecutable = shellNode;
    return cachedNodeExecutable;
  }

  // Do not use Electron's process.execPath here: it would put native extensions back on the
  // Electron ABI. If discovery reaches this fallback, spawn will fail with a clear host error.
  cachedNodeExecutable = "node";
  return cachedNodeExecutable;
}

export function getElectronResourcesPath() {
  const processWithResourcesPath = process as NodeJS.Process & { resourcesPath?: string };
  return (
    process.env.HOWCODE_ELECTRON_RESOURCES_PATH?.trim() ||
    processWithResourcesPath.resourcesPath ||
    ""
  );
}

export function getBundledSkillsPath() {
  const resourcesPath = getElectronResourcesPath();
  return resourcesPath ? path.join(resourcesPath, "resources", "skills") : "";
}
