const { contextBridge, ipcRenderer } = require("electron");
const { isDesktopAction } = require("./contracts.cjs");

contextBridge.exposeInMainWorld("piDesktop", {
  getShellState: () => ipcRenderer.invoke("pi:get-shell-state"),
  getThread: (sessionPath) => ipcRenderer.invoke("pi:get-thread", { sessionPath }),
  invokeAction: (action, payload = {}) => {
    if (!isDesktopAction(action)) {
      throw new Error(`Unsupported renderer desktop action: ${String(action)}`);
    }

    return ipcRenderer.invoke("pi:invoke-action", { action, payload });
  },
});
