import { InstalledPluginsProvider } from '@howaboua/howcode-sdk/installed-plugins'
import type {
  PluginRendererContribution,
  PluginRendererHost,
  PluginRequest,
} from '@howaboua/howcode-sdk/plugins'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import {
  type HowcodeKeybindingCommandDetail,
  howcodeKeybindingCommandEvent,
} from '../app-shell/keybinding-events'
import { subscribeDesktopEvents } from '../query/desktop-query'
import { installedRendererContributions } from './installed-renderers.generated'

const installedPluginNames = Object.keys(installedRendererContributions)

export function InstalledComponentProviders({
  enabled,
  retain,
  children,
}: {
  enabled: boolean
  retain: boolean
  children: ReactNode
}) {
  const hosts = useMemo(
    () =>
      Object.entries(installedRendererContributions).map(([name, contribution]) => {
        const request: PluginRequest = async <Result,>(
          method: string,
          payload: unknown,
        ): Promise<Result> => {
          if (!window.piDesktop) throw new Error('Desktop bridge is unavailable.')
          return (await window.piDesktop.pluginRequest(name, method, payload)) as Result
        }
        const host: PluginRendererHost = {
          enabled: name === '@howaboua/howcode-git' ? enabled : true,
          retain,
          request,
          subscribe: (listener) =>
            subscribeDesktopEvents((event) => {
              if (event.type === 'plugin-event' && event.plugin === name) listener(event.event)
            }),
          subscribeCommand: (command, listener) => {
            const receive = (event: Event) => {
              if (
                (event as CustomEvent<HowcodeKeybindingCommandDetail>).detail?.commandId === command
              )
                listener(event)
            }
            window.addEventListener(howcodeKeybindingCommandEvent, receive)
            return () => window.removeEventListener(howcodeKeybindingCommandEvent, receive)
          },
        }
        return { name, contribution: contribution as PluginRendererContribution, host }
      }),
    [enabled, retain],
  )
  const content = hosts.reduceRight((nested, { name, contribution, host }) => {
    const Provider = contribution.Provider
    return Provider ? (
      <Provider key={name} host={host}>
        {nested}
      </Provider>
    ) : (
      nested
    )
  }, children)
  return <InstalledPluginsProvider names={installedPluginNames}>{content}</InstalledPluginsProvider>
}
