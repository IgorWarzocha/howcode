import type { PluginRendererContribution } from '@howaboua/howcode-sdk/plugins'
import * as Schema from 'effect/Schema'
import { useEffect, useRef, useSyncExternalStore } from 'react'
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
import { isGitRendererApi } from './git-renderer-api'
import { hasIndependentRendererFeatures } from './navigation-selection'

type Loaded = {
  id: string
  revision: string
  contribution: PluginRendererContribution
  css: string
}
type Catalog = {
  descriptors: readonly InstalledComponentDescriptor[]
  navigationPackages: string[]
  loading: boolean
  contributions: Record<string, PluginRendererContribution>
  styles: { id: string; css: string }[]
  errors: string[]
  references: Record<string, { id: string; revision: string }>
}
let snapshot: Catalog = {
  descriptors: [],
  navigationPackages: [],
  loading: true,
  contributions: {},
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

function validateNavigationRenderer(view: PluginRendererContribution['navigation']) {
  if (view === undefined) return
  if (
    !view ||
    typeof view !== 'object' ||
    Object.keys(view).some(
      (key) => !['label', 'Content', 'History', 'BranchSwitcher'].includes(key),
    ) ||
    typeof view.label !== 'string' ||
    !view.label.trim() ||
    !(
      typeof view.Content === 'function' ||
      (view.Content && typeof view.Content === 'object' && '$$typeof' in view.Content)
    ) ||
    (view.History !== undefined &&
      typeof view.History !== 'function' &&
      !(view.History && typeof view.History === 'object' && '$$typeof' in view.History)) ||
    (view.BranchSwitcher !== undefined &&
      typeof view.BranchSwitcher !== 'function' &&
      !(
        view.BranchSwitcher &&
        typeof view.BranchSwitcher === 'object' &&
        '$$typeof' in view.BranchSwitcher
      ))
  )
    throw new Error('Invalid navigation renderer contribution.')
}

function validateSettings(settings: PluginRendererContribution['settings']) {
  if (settings === undefined) return
  if (
    !settings ||
    typeof settings !== 'object' ||
    Object.keys(settings).some((key) => !['label', 'description', 'Content'].includes(key)) ||
    typeof settings.label !== 'string' ||
    !settings.label.trim() ||
    typeof settings.description !== 'string' ||
    !(
      typeof settings.Content === 'function' ||
      (settings.Content && typeof settings.Content === 'object' && '$$typeof' in settings.Content)
    )
  )
    throw new Error('Invalid settings contribution.')
}

function validateContribution(value: unknown): PluginRendererContribution {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Renderer export must be a default contribution.')
  const allowed = new Set([
    'Provider',
    'OutputPreview',
    'OutputThumbnail',
    'TurnAttachments',
    'WorkspaceSidebar',
    'WorkspaceActions',
    'ComposerActions',
    'ConversationContent',
    'ChatRenderer',
    'artifacts',
    'draftInput',
    'composer',
    'sidebarView',
    'navigation',
    'settings',
    'component',
    'git',
    'TerminalDrawer',
    'TerminalPanel',
    'TerminalComposerControl',
  ])
  for (const [name, exportValue] of Object.entries(value)) {
    if (!allowed.has(name)) throw new Error(`Unsupported renderer contribution: ${name}`)
    if (
      name !== 'component' &&
      name !== 'sidebarView' &&
      name !== 'navigation' &&
      name !== 'settings' &&
      name !== 'git' &&
      name !== 'artifacts' &&
      name !== 'draftInput' &&
      name !== 'composer' &&
      typeof exportValue !== 'function' &&
      !(exportValue && typeof exportValue === 'object' && '$$typeof' in exportValue)
    )
      throw new Error(`Renderer ${name} must be a component function.`)
  }
  const contribution = value as PluginRendererContribution
  if (contribution.git !== undefined && !isGitRendererApi(contribution.git))
    throw new Error('Invalid Git renderer API. Every public feature export must be callable.')
  validateSidebarView(contribution.sidebarView)
  validateNavigationRenderer(contribution.navigation)
  validateSettings(contribution.settings)
  validateArtifactRenderer(contribution.artifacts)
  validateDraftInput(contribution.draftInput)
  validateComposer(contribution.composer)
  if (contribution.component) validateNavigation(contribution.component)
  return contribution
}

function validateArtifactRenderer(artifacts: PluginRendererContribution['artifacts']) {
  if (artifacts === undefined) return
  if (
    !artifacts ||
    typeof artifacts !== 'object' ||
    Object.keys(artifacts).some((key) => !['Panel', 'ComposerControl'].includes(key)) ||
    [artifacts.Panel, artifacts.ComposerControl].some(
      (component) =>
        typeof component !== 'function' &&
        !(component && typeof component === 'object' && '$$typeof' in component),
    )
  )
    throw new Error('Invalid artifact renderer contribution.')
}

function validateDraftInput(api: PluginRendererContribution['draftInput']) {
  if (api === undefined) return
  if (
    !api ||
    typeof api !== 'object' ||
    Object.keys(api).some(
      (key) => !['useDraftInput', 'Controls', 'useCommand', 'DraftInput'].includes(key),
    ) ||
    typeof api.useDraftInput !== 'function' ||
    typeof api.useCommand !== 'function' ||
    [api.Controls, api.DraftInput].some(
      (component) =>
        typeof component !== 'function' &&
        !(component && typeof component === 'object' && '$$typeof' in component),
    )
  )
    throw new Error('Invalid draft input contribution.')
}

function validateComposer(api: PluginRendererContribution['composer']) {
  if (api === undefined) return
  if (
    !api ||
    typeof api !== 'object' ||
    Object.keys(api).some(
      (key) => !['Composer', 'InboxComposer', 'QueuedPrompts', 'ModelPicker'].includes(key),
    ) ||
    [api.Composer, api.InboxComposer, api.QueuedPrompts, api.ModelPicker].some(
      (component) =>
        typeof component !== 'function' &&
        !(component && typeof component === 'object' && '$$typeof' in component),
    )
  )
    throw new Error('Invalid composer contribution.')
}

async function resolveDescriptor(
  descriptor: InstalledComponentDescriptor,
  previous: Loaded | undefined,
  errors: string[],
  navigationRenderer: string,
) {
  if (descriptor.navigation && descriptor.name !== navigationRenderer) return undefined
  if (descriptor.status === 'pending' && descriptor.stage === 'idle') {
    errors.push(`${descriptor.name}: ${descriptor.reason}`)
    return resolveActiveRenderer(descriptor, previous, errors)
  }
  if (descriptor.status === 'error') {
    errors.push(`${descriptor.name}: ${descriptor.error}`)
    return resolveActiveRenderer(descriptor, previous, errors)
  }
  if (!descriptor.renderer) return undefined
  try {
    const loaded = previous?.revision === descriptor.revision ? previous : await load(descriptor)
    if (descriptor.navigation) validateNavigationOnly(loaded.contribution)
    if (descriptor.status === 'pending') await admitInstalledComponentQuery(descriptor)
    return loaded
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`${descriptor.name}: ${message}`)
    await rejectRendererGeneration(descriptor, message, errors)
    return resolveActiveRenderer(descriptor, previous, errors)
  }
}

async function resolveActiveRenderer(
  descriptor: InstalledComponentDescriptor,
  previous: Loaded | undefined,
  errors: string[],
) {
  if (!descriptor.activeRevision) return undefined
  if (previous?.revision === descriptor.activeRevision) return previous
  try {
    return await load({ ...descriptor, revision: descriptor.activeRevision })
  } catch (error) {
    errors.push(`${descriptor.name}: active renderer unavailable: ${String(error)}`)
    return undefined
  }
}

async function rejectRendererGeneration(
  descriptor: InstalledComponentDescriptor,
  error: string,
  errors: string[],
) {
  try {
    await admitInstalledComponentQuery({ id: descriptor.id, revision: descriptor.revision, error })
  } catch (admission) {
    errors.push(
      `${descriptor.name}: renderer error acknowledgement failed: ${admission instanceof Error ? admission.message : String(admission)}`,
    )
  }
}

function validateNavigationOnly(contribution: PluginRendererContribution) {
  if (!contribution.navigation || hasIndependentRendererFeatures(contribution))
    throw new Error('howcode.navigation requires a navigation-only renderer contribution.')
}

async function readCatalog(loaded: Map<string, Loaded>, navigationRenderer: string) {
  const errors: string[] = []
  const next = new Map<string, Loaded>()
  try {
    const descriptors = Schema.decodeUnknownSync(InstalledComponentCatalogSchema)(
      await listInstalledComponentsQuery(),
    )
    const resolved = await Promise.all(
      descriptors.map(async (descriptor) => ({
        name: descriptor.name,
        loaded: await resolveDescriptor(
          descriptor,
          loaded.get(descriptor.name),
          errors,
          navigationRenderer,
        ),
      })),
    )
    for (const item of resolved) if (item.loaded) next.set(item.name, item.loaded)
    return {
      next,
      errors,
      descriptors,
      navigationPackages: descriptors
        .filter(
          (descriptor) =>
            descriptor.navigation &&
            (descriptor.status !== 'error' || descriptor.activeRevision !== undefined),
        )
        .map((descriptor) => descriptor.name),
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
    return {
      next: loaded,
      errors,
      descriptors: snapshot.descriptors,
      navigationPackages: snapshot.navigationPackages,
    }
  }
}

function publishCatalog(
  loaded: Map<string, Loaded>,
  errors: string[],
  navigationPackages: string[],
  descriptors: readonly InstalledComponentDescriptor[],
) {
  snapshot = {
    descriptors,
    navigationPackages,
    loading: false,
    contributions: {
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
    const module: { default?: unknown; stylesheet?: unknown } = await import(/* @vite-ignore */ url)
    if (module.stylesheet !== undefined && typeof module.stylesheet !== 'string')
      throw new Error('Renderer stylesheet export must be a string.')
    return {
      id: descriptor.id,
      revision: descriptor.revision,
      contribution: validateContribution(module.default),
      css: [source.css, module.stylesheet].filter(Boolean).join('\n'),
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** One mounted composition owns catalog loading; queries never replay mutations. */
export function useInstalledComponentCatalog(navigationRenderer: string) {
  const loadedRef = useRef(new Map<string, Loaded>())
  useEffect(() => {
    let closed = false
    let refreshing = false
    let dirty = false
    let loaded = loadedRef.current
    const applyCatalog = ({
      next,
      errors,
      navigationPackages,
      descriptors,
    }: Awaited<ReturnType<typeof readCatalog>>) => {
      if (closed) return
      loaded = next
      loadedRef.current = next
      publishCatalog(loaded, errors, navigationPackages, descriptors)
    }
    const refresh = async () => {
      dirty = true
      if (refreshing) return
      refreshing = true
      try {
        while (dirty && !closed) {
          dirty = false
          await readCatalog(loaded, navigationRenderer).then(applyCatalog)
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
  }, [navigationRenderer])
  return useSyncExternalStore(subscribe, () => snapshot)
}

export function useInstalledRendererContributions() {
  return useSyncExternalStore(subscribe, () => snapshot.contributions)
}

export function useInstalledComponentReadiness() {
  return useSyncExternalStore(subscribe, () => snapshot.loading)
}

export function useInstalledComponentInventory() {
  return useSyncExternalStore(subscribe, () => snapshot.descriptors)
}

export function useInstalledNavigationPackages() {
  return useSyncExternalStore(subscribe, () => snapshot.navigationPackages)
}
