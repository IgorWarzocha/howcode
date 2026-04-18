import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserWindow } from "electron";
import { app } from "electron";
import {
  parseDevServerMetadata,
  resolveDevServerMetadataPath,
} from "../../../../shared/dev-server";
import { getRendererDistDirectory } from "../runtime/app-paths";

async function resolveDevServerUrl() {
  const metadataPath = resolveDevServerMetadataPath([
    process.env.HOWCODE_REPO_ROOT ?? "",
    app.getAppPath(),
    process.cwd(),
  ]);

  if (!metadataPath) {
    return null;
  }

  try {
    const rawMetadata = await readFile(metadataPath, "utf8");
    const devServerUrl = parseDevServerMetadata(rawMetadata);
    if (!devServerUrl) {
      return null;
    }

    await fetch(devServerUrl, { method: "HEAD" });
    return devServerUrl;
  } catch {
    return null;
  }
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
