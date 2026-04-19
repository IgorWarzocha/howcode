import path from "node:path";
import { app } from "electron";

export function getAppRootPath() {
  if (!app.isPackaged) {
    return process.env.HOWCODE_REPO_ROOT || process.cwd();
  }

  return app.getAppPath();
}

export function getDesktopBuildDirectory() {
  return path.join(getAppRootPath(), "build", "desktop");
}

export function getElectronBuildDirectory() {
  return path.join(getAppRootPath(), "build", "electron");
}

export function getRendererDistDirectory() {
  return path.join(getAppRootPath(), "dist");
}
