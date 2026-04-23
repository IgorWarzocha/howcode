import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserWindow } from "electron";
import { app } from "electron";
import {
  parseDevServerMetadata,
  resolveDevServerMetadataPath,
} from "../../../../shared/dev-server";
import { getRendererDistDirectory } from "../runtime/app-paths";

const DEV_SERVER_PROBE_TIMEOUT_MS = 1_500;
const DEV_SERVER_STARTUP_TIMEOUT_MS = 10_000;
const DEV_SERVER_RETRY_INTERVAL_MS = 250;

function waitForDevServerRetry() {
  return new Promise((resolve) => setTimeout(resolve, DEV_SERVER_RETRY_INTERVAL_MS));
}

async function probeDevServerUrl(devServerUrl: string) {
  await fetch(devServerUrl, {
    method: "HEAD",
    signal: AbortSignal.timeout(DEV_SERVER_PROBE_TIMEOUT_MS),
  });
}

async function resolveDevServerUrl() {
  const metadataPath = resolveDevServerMetadataPath([
    process.env.HOWCODE_REPO_ROOT ?? "",
    app.getAppPath(),
    process.cwd(),
  ]);

  if (!metadataPath) {
    return null;
  }

  const startupDeadline = Date.now() + DEV_SERVER_STARTUP_TIMEOUT_MS;

  while (Date.now() < startupDeadline) {
    try {
      const rawMetadata = await readFile(metadataPath, "utf8");
      const devServerUrl = parseDevServerMetadata(rawMetadata);
      if (devServerUrl) {
        await probeDevServerUrl(devServerUrl);
        return devServerUrl;
      }
    } catch {
      // The dev script writes metadata only after Vite is listening. Keep probing briefly so
      // Electron doesn't permanently fall back to the packaged renderer during slow startups.
    }

    await waitForDevServerRetry();
  }

  return null;
}

export async function loadMainWindow(mainWindow: BrowserWindow) {
  if (!app.isPackaged) {
    const devServerUrl = await resolveDevServerUrl();
    if (devServerUrl) {
      await mainWindow.loadURL(devServerUrl);
      return;
    }
  }

  await mainWindow.loadFile(path.join(getRendererDistDirectory(), "index.html"));
}
