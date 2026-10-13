import { InstalledPluginsProvider } from '@howaboua/howcode-sdk/installed-plugins'
import { type OutputPreviewProps, OutputRenderersProvider } from '@howaboua/howcode-sdk/outputs'
import type { PluginRendererHost, PluginRequest } from '@howaboua/howcode-sdk/plugins'
import type { SkillsRendererPort } from '@howaboua/howcode-sdk/skills-renderer'
import { WorkspaceSurfacesProvider } from '@howaboua/howcode-sdk/workspace-surfaces'
import type { ReactNode } from 'react'
import { useContext, useMemo } from 'react'
import {
  type HowcodeKeybindingCommandDetail,
  howcodeKeybindingCommandEvent,
} from '../app-shell/keybinding-events'
import {
  admitInstalledComponentQuery,
  requestInstalledPluginQuery,
  subscribeDesktopEvents,
} from '../query/desktop-query'
import { terminalRendererPort } from '../terminal-integration'
import { InstalledComponentBoundary } from './installed-component-boundary'
import { useInstalledComponentCatalog } from './installed-component-catalog'
import {
  type Renderer,
  RendererHostsContext,
  useInstalledPageViews,
} from './installed-renderer-context'
import { hasIndependentRendererFeatures } from './navigation-selection'
import { ComponentRendererSlots, RendererSlot, RendererSlotsProvider } from './renderer-slots'
import { RendererStyleScope } from './renderer-style-scope'

function ContextualOutputPreview(props: OutputPreviewProps) {
  const renderer = useContext(RendererHostsContext).find(
    (candidate) => candidate.host === props.host,
  )
  const Preview = renderer?.contribution.OutputPreview
  if (!(renderer && Preview)) return <p role="alert">Output renderer is no longer installed.</p>
  return (
    <RendererSlot name={renderer.name}>
      <Preview {...props} />
    </RendererSlot>
  )
}

function ContextualOutputThumbnail(props: { host: PluginRendererHost; id: string }) {
  const renderer = useContext(RendererHostsContext).find(
    (candidate) => candidate.host === props.host,
  )
  const Thumbnail = renderer?.contribution.OutputThumbnail
  return renderer && Thumbnail ? (
    <RendererSlot name={renderer.name}>
      <Thumbnail {...props} />
    </RendererSlot>
  ) : null
}

function ComponentProvider({ renderer }: { renderer: Renderer }) {
  const Provider = renderer.contribution.Provider
  const content = <ComponentRendererSlots name={renderer.name} />
  return (
    <InstalledComponentBoundary
      name={renderer.name}
      onError={(error) => {
        if (!renderer.reference) {
          console.error(`Component has no admitted generation: ${renderer.name}`, error)
          return
        }
        void admitInstalledComponentQuery({ ...renderer.reference, error }).catch(
          (acknowledgement) =>
            console.error(
              `Component failure acknowledgement failed: ${renderer.name}`,
              acknowledgement,
            ),
        )
      }}
    >
      <RendererStyleScope name={renderer.name}>
        {Provider ? <Provider host={renderer.host}>{content}</Provider> : content}
      </RendererStyleScope>
    </InstalledComponentBoundary>
  )
}

/** Each view portal stays beneath its feature Provider while the shell changes visibility. */
export function InstalledPageViews({
  activeView,
  onOpenWorkspace,
}: {
  activeView: import('../types').View
  onOpenWorkspace: () => void
}) {
  const views = useInstalledPageViews()
  return (
    <>
      {views.map(({ name, id, view, host }) => {
        const Content = view.Content
        return (
          <div
            key={name}
            className="h-full min-h-0 flex-col"
            style={{ display: activeView === id ? 'flex' : 'none' }}
          >
            <RendererSlot name={name}>
              <Content host={host} onOpenWorkspace={onOpenWorkspace} />
            </RendererSlot>
          </div>
        )
      })}
    </>
  )
}

export function InstalledComponentProviders({
  enabled,
  terminalEnabled,
  skillsEnabled,
  skills,
  retain,
  navigationRenderer,
  children,
}: {
  enabled: boolean
  terminalEnabled: boolean
  skillsEnabled: boolean
  skills: SkillsRendererPort
  retain: boolean
  navigationRenderer: string
  children: ReactNode
}) {
  const catalog = useInstalledComponentCatalog(navigationRenderer)
  const baseHosts = useMemo(() => {
    const enabledPackages: Record<string, boolean> = {
      '@howaboua/howcode-git': enabled,
      '@howaboua/howcode-terminal': terminalEnabled,
      '@howaboua/howcode-skills': skillsEnabled,
    }
    return Object.entries(catalog.contributions).map(([name, contribution]) => {
      const request: PluginRequest = async <Result,>(
        method: string,
        payload: unknown,
      ): Promise<Result> => {
        return requestInstalledPluginQuery<Result>(name, method, payload)
      }
      const reference = catalog.references[name]
      const host: PluginRendererHost = {
        ...(reference ? { revision: reference.revision } : {}),
        enabled: enabledPackages[name] ?? true,
        ...(name === '@howaboua/howcode-terminal' ? { terminal: terminalRendererPort } : {}),
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
      return {
        name,
        contribution,
        host,
        ...(reference ? { reference } : {}),
      }
    })
  }, [catalog.contributions, catalog.references, enabled, terminalEnabled, skillsEnabled, retain])
  // A changing Skills port must not retire peer components' host identities.
  const hosts = useMemo(
    () =>
      baseHosts.map((renderer) =>
        renderer.name === '@howaboua/howcode-skills'
          ? { ...renderer, host: { ...renderer.host, skills } }
          : renderer,
      ),
    [baseHosts, skills],
  )
  const outputRenderers = useMemo(
    () =>
      hosts.flatMap(({ name, contribution, host }) =>
        contribution.OutputPreview
          ? [
              {
                name,
                host,
                Preview: ContextualOutputPreview,
                ...(contribution.OutputThumbnail ? { Thumbnail: ContextualOutputThumbnail } : {}),
              },
            ]
          : [],
      ),
    [hosts],
  )
  const mountedHosts = hosts.filter(
    ({ name, contribution }) =>
      !contribution.navigation ||
      name === navigationRenderer ||
      hasIndependentRendererFeatures(contribution),
  )
  return (
    <WorkspaceSurfacesProvider>
      <InstalledPluginsProvider names={Object.keys(catalog.contributions)}>
        <RendererSlotsProvider>
          {catalog.styles
            .filter(({ id }) =>
              mountedHosts.some(({ name, reference }) => id === `${name}@${reference?.revision}`),
            )
            .map(({ id, css }) => (
              <style key={id}>{css}</style>
            ))}
          {catalog.errors.map((error) => (
            <p key={error} role="alert">
              {error}
            </p>
          ))}
          <RendererHostsContext value={mountedHosts}>
            <OutputRenderersProvider renderers={outputRenderers}>
              {children}
              {mountedHosts.map((renderer) => (
                <ComponentProvider
                  key={`${renderer.name}@${renderer.reference?.revision ?? 'bundled'}`}
                  renderer={renderer}
                />
              ))}
            </OutputRenderersProvider>
          </RendererHostsContext>
        </RendererSlotsProvider>
      </InstalledPluginsProvider>
    </WorkspaceSurfacesProvider>
  )
}
