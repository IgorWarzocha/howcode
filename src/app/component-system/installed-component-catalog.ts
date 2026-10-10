import type { PluginRendererContribution } from '@howaboua/howcode-sdk/plugins'
import * as Schema from 'effect/Schema'
import { useEffect, useSyncExternalStore } from 'react'
import type { InstalledComponentDescriptor } from '../../../shared/installed-component-contracts'
import {
  InstalledComponentCatalogSchema,
  InstalledComponentSourceSchema,
} from '../../../shared/installed-component-contracts'
import { isKeybindingCommandId } from '../../../shared/keybindings'
import {
  admitInstalledComponentQuery,
  listInstalledComponentsQuery,
  loadInstalledComponentQuery,
  subscribeDesktopEvents,
} from '../query/desktop-query'
import { builtInPagePaths } from '../types'
import { installComponentModuleBridge } from './component-module-bridge'
import { installedRendererContributions } from './installed-renderers.generated'

type Loaded = {
  id: string
  revision: string
  contribution: PluginRendererContribution
  css: string
}
type Catalog = {
  loading: boolean
  contributions: Record<string, PluginRendererContribution>
  styles: { id: string; css: string }[]
  errors: string[]
  references: Record<string, { id: string; revision: string }>
}
let snapshot: Catalog = {
  loading: true,
  contributions: installedRendererContributions,
  styles: [],
  errors: [],
  references: {},
}
const listeners = new Set<() => void>()
export function getInstalledRendererContributions() {
  return snapshot.contributions
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function validateNavigation(metadata: NonNullable<PluginRendererContribution['component']>) {
  const metadataKeys = new Set([
    'id',
    'views',
    'selectedConversationViews',
    'utilityViews',
    'keybindings',
  ])
  if (Object.keys(metadata).some((key) => !metadataKeys.has(key)))
    throw new Error('Unsupported component navigation metadata.')
  const views = new Set(Object.keys(builtInPagePaths))
  if (
    typeof metadata.id !== 'string' ||
    !Array.isArray(metadata.views) ||
    !Array.isArray(metadata.selectedConversationViews) ||
    !Array.isArray(metadata.utilityViews) ||
    !Array.isArray(metadata.keybindings)
  )
    throw new Error('Invalid component navigation/keybinding contribution.')
  if (
    [...metadata.views, ...metadata.selectedConversationViews, ...metadata.utilityViews].some(
      (view) => !views.has(view),
    )
  )
    throw new Error(
      'New shell routes are not supported by the installed component contract. Use workspace surfaces.',
    )
  if (
    metadata.utilityViews.some((view) => !['settings', 'skills', 'history'].includes(view)) ||
    metadata.keybindings.some((binding) => !isKeybindingCommandId(binding.id))
  )
    throw new Error(
      'Unsupported utility route or shell command. Use the public workspace surface contract.',
    )
  for (const binding of metadata.keybindings) validateKeybinding(binding)
}

function validateKeybinding(
  binding: NonNullable<PluginRendererContribution['component']>['keybindings'][number],
) {
  const keys = new Set(['id', 'renderer', 'layer', 'allowFromTextInput'])
  if (Object.keys(binding).some((key) => !keys.has(key)))
    throw new Error(`Unsupported keybinding metadata: ${binding.id}`)
  if (binding.renderer !== undefined && typeof binding.renderer !== 'boolean')
    throw new Error(`Invalid renderer keybinding flag: ${binding.id}`)
  if (binding.layer !== undefined && binding.layer !== 'modal' && binding.layer !== 'settings')
    throw new Error(`Invalid keybinding layer: ${binding.id}`)
  if (binding.allowFromTextInput !== undefined && typeof binding.allowFromTextInput !== 'function')
    throw new Error(`Invalid keybinding predicate: ${binding.id}`)
}

function validateSidebarView(view: PluginRendererContribution['sidebarView']) {
  if (view === undefined) return
  if (
    !view ||
    typeof view !== 'object' ||
    Object.keys(view).some((key) => !['label', 'Content'].includes(key)) ||
    typeof view.label !== 'string' ||
    !view.label.trim() ||
    !(
      typeof view.Content === 'function' ||
      (view.Content && typeof view.Content === 'object' && '$$typeof' in view.Content)
    )
  )
    throw new Error('Invalid sidebar view contribution.')
}

function validateContribution(value: unknown): PluginRendererContribution {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Renderer export must be a default contribution.')
  const allowed = [
    'Provider',
    'OutputPreview',
    'OutputThumbnail',
    'TurnAttachments',
    'sidebarView',
    'component',
  ]
  for (const [name, exportValue] of Object.entries(value)) {
    if (!allowed.includes(name)) throw new Error(`Unsupported renderer contribution: ${name}`)
    if (
      name !== 'component' &&
      name !== 'sidebarView' &&
      typeof exportValue !== 'function' &&
      !(exportValue && typeof exportValue === 'object' && '$$typeof' in exportValue)
    )
      throw new Error(`Renderer ${name} must be a component function.`)
  }
  const contribution = value as PluginRendererContribution
  validateSidebarView(contribution.sidebarView)
  if (contribution.component) validateNavigation(contribution.component)
  return contribution
}

async function resolveDescriptor(
  descriptor: InstalledComponentDescriptor,
  previous: Loaded | undefined,
  errors: string[],
) {
  if (descriptor.status === 'pending' && descriptor.stage === 'idle') {
    errors.push(`${descriptor.name}: ${descriptor.reason}`)
    return previous
  }
  if (descriptor.status === 'error') {
    errors.push(`${descriptor.name}: ${descriptor.error}`)
    return undefined
  }
  if (!descriptor.renderer) return undefined
  try {
    const loaded = previous?.revision === descriptor.revision ? previous : await load(descriptor)
    if (descriptor.status === 'pending') await admitInstalledComponentQuery(descriptor)
    return loaded
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`${descriptor.name}: ${message}`)
    try {
      await admitInstalledComponentQuery({
        id: descriptor.id,
        revision: descriptor.revision,
        error: message,
      })
    } catch (admission) {
      errors.push(
        `${descriptor.name}: renderer error acknowledgement failed: ${admission instanceof Error ? admission.message : String(admission)}`,
      )
    }
    return undefined
  }
}

async function readCatalog(loaded: Map<string, Loaded>) {
  const errors: string[] = []
  const next = new Map<string, Loaded>()
  try {
    const descriptors = Schema.decodeUnknownSync(InstalledComponentCatalogSchema)(
      await listInstalledComponentsQuery(),
    )
    const resolved = await Promise.all(
      descriptors.map(async (descriptor) => ({
        name: descriptor.name,
        loaded: await resolveDescriptor(descriptor, loaded.get(descriptor.name), errors),
      })),
    )
    for (const item of resolved) if (item.loaded) next.set(item.name, item.loaded)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
    return { next: loaded, errors }
  }
  return { next, errors }
}

function publishCatalog(loaded: Map<string, Loaded>, errors: string[]) {
  snapshot = {
    loading: false,
    contributions: {
      ...installedRendererContributions,
      ...Object.fromEntries([...loaded].map(([name, item]) => [name, item.contribution])),
    },
    styles: [...loaded]
      .filter(([, item]) => item.css)
      .map(([name, item]) => ({ id: `${name}@${item.revision}`, css: item.css })),
    errors,
    references: Object.fromEntries(
      [...loaded].map(([name, item]) => [name, { id: item.id, revision: item.revision }]),
    ),
  }
  for (const listener of listeners) listener()
}

async function load(descriptor: InstalledComponentDescriptor): Promise<Loaded> {
  const source = Schema.decodeUnknownSync(InstalledComponentSourceSchema)(
    await loadInstalledComponentQuery(descriptor),
  )
  installComponentModuleBridge()
  const url = URL.createObjectURL(new Blob([source.js], { type: 'text/javascript' }))
  try {
    const module: { default?: unknown } = await import(/* @vite-ignore */ url)
    return {
      id: descriptor.id,
      revision: descriptor.revision,
      contribution: validateContribution(module.default),
      css: source.css,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** One mounted composition owns catalog loading; queries never replay mutations. */
export function useInstalledComponentCatalog() {
  useEffect(() => {
    let closed = false
    let refreshing = false
    let dirty = false
    let loaded = new Map<string, Loaded>()
    const applyCatalog = ({ next, errors }: Awaited<ReturnType<typeof readCatalog>>) => {
      if (closed) return
      loaded = next
      publishCatalog(loaded, errors)
    }
    const refresh = async () => {
      dirty = true
      if (refreshing) return
      refreshing = true
      try {
        while (dirty && !closed) {
          dirty = false
          await readCatalog(loaded).then(applyCatalog)
        }
      } finally {
        refreshing = false
      }
    }
    const unsubscribe = subscribeDesktopEvents((event) => {
      if (event.type === 'package-ui-invalidation') void refresh()
    })
    void refresh()
    return () => {
      closed = true
      unsubscribe()
    }
  }, [])
  return useSyncExternalStore(subscribe, () => snapshot)
}

export function useInstalledRendererContributions() {
  return useSyncExternalStore(subscribe, () => snapshot.contributions)
}

export function useInstalledComponentReadiness() {
  return useSyncExternalStore(subscribe, () => snapshot.loading)
}
