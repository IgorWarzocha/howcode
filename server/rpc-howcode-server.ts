import { Effect, Queue, Stream } from 'effect'
import type { AppTransport } from '../shared/app-transport'
import type {
  DesktopEventChannel,
  DesktopEventMap,
  DesktopRequestChannel,
  DesktopRequestMap,
} from '../shared/desktop-ipc'
import {
  type HowcodeRpcEventEnvelope,
  HowcodeRpcGroup,
  HowcodeRpcRequestError,
} from '../shared/howcode-rpc'

export function createHowcodeRpcLayer(transport: AppTransport) {
  return HowcodeRpcGroup.toLayer({
    'app.request': ({ channel, params }) =>
      Effect.tryPromise({
        try: () =>
          transport.request(
            channel as DesktopRequestChannel,
            params as DesktopRequestMap[DesktopRequestChannel]['params'],
          ),
        catch: (cause) =>
          new HowcodeRpcRequestError({
            channel,
            message: cause instanceof Error ? cause.message : 'Howcode RPC request failed.',
          }),
      }),
    'events.subscribe': ({ channel }) =>
      Stream.callback<HowcodeRpcEventEnvelope>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() =>
            transport.subscribe(
              channel as DesktopEventChannel,
              (event: DesktopEventMap[DesktopEventChannel]) => {
                Queue.offerUnsafe(queue, {
                  channel,
                  event,
                })
              },
            ),
          ),
          (unsubscribe) => Effect.sync(unsubscribe),
        ),
      ),
  })
}
