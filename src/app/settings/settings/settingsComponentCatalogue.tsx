import { Button } from '@howaboua/howcode-sdk/ui/controls'
import { toolkitComponents } from '@howcode/shared/toolkit-components'
import { useContext, useRef, useState } from 'react'
import type { InstalledComponentDescriptor } from '../../../../shared/installed-component-contracts'
import { useInstalledComponentInventory } from '../../component-system/installed-component-catalog'
import {
  type Renderer,
  RendererHostsContext,
} from '../../component-system/installed-renderer-context'
import { RendererSlot } from '../../component-system/renderer-slots'
import {
  installInstalledComponentQuery,
  removeInstalledComponentQuery,
  updateInstalledComponentQuery,
} from '../../query/desktop-query'
import { SettingRow } from './setting-row'
import type { SettingDescriptor } from './settingsTypes'

type Mutation = 'install' | 'update' | 'remove'
const mutations = {
  install: installInstalledComponentQuery,
  update: updateInstalledComponentQuery,
  remove: removeInstalledComponentQuery,
}

function useComponentMutation() {
  const busy = useRef(false)
  const [state, setState] = useState<{
    kind: Mutation
    source: string
    status: 'pending' | 'complete' | 'error'
    message: string
  } | null>(null)
  const mutate = async (kind: Mutation, source: string) => {
    if (busy.current) return
    busy.current = true
    setState({
      kind,
      source,
      status: 'pending',
      message: `${kind === 'install' ? 'Installing' : kind === 'update' ? 'Updating' : 'Removing'}…`,
    })
    try {
      await mutations[kind](source)
      setState({
        kind,
        source,
        status: 'complete',
        message:
          kind === 'remove'
            ? 'Removed.'
            : 'Package saved. Activation status is shown in the catalogue.',
      })
    } catch (error) {
      setState({
        kind,
        source,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      busy.current = false
    }
  }
  return { state, mutate, pending: state?.status === 'pending' }
}

type CatalogueEntry = {
  id: string
  label: string
  description: string
  status: string
  source: string | undefined
  settingsId: string
}

function componentStatus(descriptor: InstalledComponentDescriptor | undefined) {
  if (!descriptor) return 'Loading'
  if (descriptor.status === 'error') return descriptor.error
  if (descriptor.status === 'pending') return descriptor.reason
  return descriptor.renderer ? 'Ready' : 'Ready (no renderer)'
}

function catalogueEntries(
  inventory: readonly InstalledComponentDescriptor[],
  renderers: Renderer[],
): CatalogueEntry[] {
  const builtIns = toolkitComponents
    .filter(({ id }) => id !== 'terminal' && id !== 'skills')
    .map((component) => ({
      ...component,
      status: 'Built in',
      source: undefined,
      settingsId: component.id,
    }))
  const names = new Set([
    ...inventory.map(({ name }) => name),
    ...renderers.map(({ name }) => name),
  ])
  return [
    ...builtIns,
    ...[...names].sort().map((name) => {
      const descriptor = inventory.find((component) => component.name === name)
      const contribution = renderers.find((candidate) => candidate.name === name)?.contribution
      return {
        id: name,
        source: descriptor?.source,
        settingsId: contribution?.component?.id ?? name,
        label:
          contribution?.settings?.label ??
          contribution?.navigation?.label ??
          contribution?.sidebarView?.label ??
          name,
        description: contribution?.settings?.description ?? '',
        status: componentStatus(descriptor),
      }
    }),
  ]
}

function ComponentDetails({
  entry,
  renderer,
  settings,
  mutation,
}: {
  entry: CatalogueEntry
  renderer: Renderer | undefined
  settings: SettingDescriptor[]
  mutation: ReturnType<typeof useComponentMutation>
}) {
  const Content = renderer?.contribution.settings?.Content
  const controls = settings.filter((setting) => setting.componentId === entry.settingsId)
  const source = entry.source
  return (
    <div className="grid min-w-0 gap-3">
      <h2 className="text-lg font-medium">{entry.label}</h2>
      {entry.description ? (
        <p className="text-sm text-[color:var(--muted)]">{entry.description}</p>
      ) : null}
      <p role="status" className="break-words text-sm text-[color:var(--muted)]">
        {entry.status}
      </p>
      {source ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={mutation.pending}
            onClick={() => void mutation.mutate('update', source)}
          >
            Update
          </Button>
          <Button
            disabled={mutation.pending}
            onClick={() => void mutation.mutate('remove', source)}
          >
            Remove
          </Button>
        </div>
      ) : null}
      <div className="grid min-w-0">
        {controls.map((setting) => (
          <SettingRow key={setting.id} setting={setting} />
        ))}
      </div>
      {Content && renderer ? (
        <RendererSlot name={renderer.name}>
          <Content host={renderer.host} />
        </RendererSlot>
      ) : controls.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">
          This component does not expose settings here.
        </p>
      ) : null}
    </div>
  )
}

export function SettingsComponentCatalogue({
  settings,
  filter,
  target,
}: {
  settings: SettingDescriptor[]
  filter: string
  target: string | undefined
}) {
  const inventory = useInstalledComponentInventory()
  const renderers = useContext(RendererHostsContext)
  const mutation = useComponentMutation()
  const [source, setSource] = useState('')
  const [selection, setSelection] = useState<{ target: string | undefined; id: string } | null>(
    null,
  )
  const selectedId = selection && selection.target === target ? selection.id : target
  const entries = catalogueEntries(inventory, renderers)
  const visible = entries.filter((entry) =>
    [
      entry.id,
      entry.label,
      entry.description,
      ...settings
        .filter((setting) => setting.componentId === entry.settingsId)
        .flatMap((setting) => [setting.title, setting.description, setting.keywords ?? '']),
    ]
      .join(' ')
      .toLowerCase()
      .includes(filter),
  )
  const selected = entries.find((entry) => entry.id === selectedId)
  const renderer = renderers.find((entry) => entry.name === selected?.id)

  return (
    <section className="grid min-w-0 gap-4 lg:col-span-full" aria-label="Components">
      <p className="text-sm text-[color:var(--muted)]">
        Workspace controls and installed packages. Agent tools are selected separately for each
        conversation.
      </p>
      <form
        className="flex min-w-0 flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (source.trim()) void mutation.mutate('install', source.trim())
        }}
      >
        <input
          aria-label="Component package source"
          className="min-w-0 flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder="npm:package, Git URL, or local path"
          disabled={mutation.pending}
        />
        <Button type="submit" disabled={mutation.pending || !source.trim()}>
          Install
        </Button>
      </form>
      {mutation.state ? (
        <p
          role={mutation.state.status === 'error' ? 'alert' : 'status'}
          className="break-words text-sm text-[color:var(--muted)]"
        >
          {mutation.state.message}
        </p>
      ) : null}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)]">
        <nav className="grid content-start gap-1" aria-label="Installed components">
          {visible.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={selected?.id === entry.id}
              className={`min-w-0 rounded-md px-3 py-2 text-left hover:bg-[color:var(--surface-hover)] ${selected?.id === entry.id ? 'bg-[color:var(--accent-bg)]' : ''}`}
              onClick={() => setSelection({ target, id: entry.id })}
            >
              <span className="block break-words text-sm">{entry.label}</span>
              <span className="block break-words text-xs text-[color:var(--muted)]">
                {entry.status}
              </span>
            </button>
          ))}
          {visible.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">No matching components.</p>
          ) : null}
        </nav>
        <div className="min-w-0">
          {selected ? (
            <ComponentDetails
              key={selected.id}
              entry={selected}
              renderer={renderer}
              settings={settings}
              mutation={mutation}
            />
          ) : (
            <p className="text-sm text-[color:var(--muted)]">
              Select a component to view its settings.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
