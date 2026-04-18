import path from "node:path";
import { BrowserWindow } from "electron";
import { getElectronBuildDirectory } from "../runtime/app-paths";

export function createMainWindow() {
  return new BrowserWindow({
    title: "howcode",
    width: 1480,
    height: 980,
    x: 120,
    y: 80,
    webPreferences: {
      preload: path.join(getElectronBuildDirectory(), "preload", "index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
}
