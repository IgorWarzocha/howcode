export type DesktopBridgeCapabilities = {
  localFilePathFromBrowserFile: boolean
  browserUploads: boolean
  hostOpenPath: boolean
  browserOpenExternal: boolean
  hostClipboard: boolean
  browserClipboard: boolean
}

export const electronDesktopBridgeCapabilities: DesktopBridgeCapabilities = {
  localFilePathFromBrowserFile: true,
  browserUploads: false,
  hostOpenPath: true,
  browserOpenExternal: false,
  hostClipboard: true,
  browserClipboard: true,
}

export const browserDesktopBridgeCapabilities: DesktopBridgeCapabilities = {
  localFilePathFromBrowserFile: false,
  browserUploads: true,
  hostOpenPath: true,
  browserOpenExternal: true,
  hostClipboard: true,
  browserClipboard: true,
}
