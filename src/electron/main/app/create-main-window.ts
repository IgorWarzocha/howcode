import path from "node:path";
import { app, BrowserWindow } from "electron";

export function createMainWindow() {
  return new BrowserWindow({
    title: "howcode",
    width: 1480,
    height: 980,
    x: 120,
    y: 80,
    webPreferences: {
      preload: path.join(app.getAppPath(), "build", "electron", "preload", "index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
}
