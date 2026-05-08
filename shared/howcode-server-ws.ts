import type { DesktopEventChannel, DesktopEventMap } from './desktop-ipc'

export type HowcodeServerWsClientMessage =
  | {
      type: 'subscribe'
      channel: DesktopEventChannel
    }
  | {
      type: 'unsubscribe'
      channel: DesktopEventChannel
    }

export type HowcodeServerWsServerMessage<K extends DesktopEventChannel = DesktopEventChannel> = {
  type: 'event'
  channel: K
  event: DesktopEventMap[K]
}
