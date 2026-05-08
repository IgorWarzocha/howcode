import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from './desktop-ipc'

export interface AppTransport {
  request<K extends DesktopRequestChannel>(
    channel: K,
    params: DesktopRequestMap[K]['params'],
  ): Promise<DesktopRequestMap[K]['response']>

  subscribe<K extends DesktopEventChannel>(
    channel: K,
    listener: (event: DesktopEventMap[K]) => void,
  ): () => void
}
