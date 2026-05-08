import { type IpcRendererEvent, ipcRenderer, webUtils } from 'electron'
import type { AppTransport } from '../../../shared/app-transport'
import {
  type DesktopEventChannel,
  type DesktopEventMap,
  type DesktopRequestChannel,
  type DesktopRequestMap,
  getDesktopEventIpcChannel,
  getDesktopRequestIpcChannel,
} from '../../../shared/desktop-ipc'
import { createDesktopApiFromTransport } from '../../app/desktop/create-desktop-api-from-transport'

const electronIpcTransport: AppTransport = {
  request: <K extends DesktopRequestChannel>(channel: K, params: DesktopRequestMap[K]['params']) =>
    ipcRenderer.invoke(getDesktopRequestIpcChannel(channel), params) as Promise<
      DesktopRequestMap[K]['response']
    >,
  subscribe: <K extends DesktopEventChannel>(
    channel: K,
    listener: (event: DesktopEventMap[K]) => void,
  ) => {
    const ipcChannel = getDesktopEventIpcChannel(channel)
    const wrappedListener = (_event: IpcRendererEvent, payload: DesktopEventMap[K]) => {
      listener(payload)
    }

    ipcRenderer.on(ipcChannel, wrappedListener)
    return () => {
      ipcRenderer.removeListener(ipcChannel, wrappedListener)
    }
  },
}

export function createDesktopApi() {
  return createDesktopApiFromTransport(electronIpcTransport, {
    getPathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file) || null
      } catch {
        return null
      }
    },
  })
}
