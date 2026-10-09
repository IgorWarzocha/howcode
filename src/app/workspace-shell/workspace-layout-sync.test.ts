import {
  createWorkspaceLayoutSnapshot,
  parseWorkspaceLayoutSnapshot,
  type WorkspaceLayoutSnapshot,
} from '@howaboua/howcode-sdk/workspace-layout-state'
import type {
  ChatWorkspaceLayout,
  WorkspaceLayoutRequest,
  WorkspaceLayoutResponse,
} from '@howcode/shared/workspace-layout-contracts'
import { expect, it, vi } from 'vitest'
import { connectWorkspaceLayout } from './workspace-layout-sync'

function fixture() {
  let visible = createWorkspaceLayoutSnapshot()
  let state: ChatWorkspaceLayout = {
    conversationId: 'chat',
    workspaceId: 'workspace',
    revision: 0,
    layout: visible,
  }
  const listeners = new Set<(layout: WorkspaceLayoutSnapshot) => void>()
  const host = {
    exportLayout: () => visible,
    restoreLayout: (layout: unknown) => {
      visible = parseWorkspaceLayoutSnapshot(layout)
    },
    subscribeLayout: (listener: (layout: WorkspaceLayoutSnapshot) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  const apply = (request: WorkspaceLayoutRequest): WorkspaceLayoutResponse => {
    if (request.action !== 'read' && request.revision !== state.revision)
      return { status: 'conflict', state }
    if (request.action === 'save')
      state = { ...state, layout: request.layout, revision: state.revision + 1 }
    return { status: 'saved', state }
  }
  const options = {
    host,
    conversationId: 'chat',
    lane: { current: Promise.resolve() },
    request: vi.fn(async (request: WorkspaceLayoutRequest) => apply(request)),
    subscribe: () => vi.fn(),
    onStatus: vi.fn(),
    onReady: vi.fn(),
  }
  return {
    options,
    apply,
    edit: (width: number) => {
      visible = { ...visible, sidebarWidths: { ...visible.sidebarWidths, left: width } }
      for (const listener of listeners) listener(visible)
    },
  }
}

it('drains captured saves before a replacement connection reads, without restoring into the disposed view', async () => {
  const { options, apply, edit } = fixture()
  const disconnect = connectWorkspaceLayout(options)
  await options.lane.current
  const pending = Promise.withResolvers<WorkspaceLayoutResponse>()
  let commit: (() => WorkspaceLayoutResponse) | undefined
  options.request.mockImplementationOnce((request) => {
    commit = () => apply(request)
    return pending.promise
  })
  edit(600)
  await Promise.resolve()
  edit(620)
  disconnect()
  const oldStatus = options.onStatus.mock.calls.length
  const nextStatus = vi.fn()
  const disconnectNext = connectWorkspaceLayout({ ...options, onStatus: nextStatus })
  await Promise.resolve()
  expect(options.request.mock.calls.map(([request]) => request.action)).toEqual(['read', 'save'])
  expect(commit).toBeDefined()
  if (!commit) throw new Error('Save did not start.')
  pending.resolve(commit())
  await options.lane.current
  expect(options.request.mock.calls.map(([request]) => request.action)).toEqual([
    'read',
    'save',
    'save',
    'read',
  ])
  expect(options.host.exportLayout().sidebarWidths.left).toBe(620)
  expect(options.onStatus).toHaveBeenCalledTimes(oldStatus)
  edit(700)
  await options.lane.current
  expect(options.request).toHaveBeenLastCalledWith(
    expect.objectContaining({ action: 'save', revision: 2 }),
  )
  expect(nextStatus.mock.calls.every(([status]) => status.message === '')).toBe(true)
  disconnectNext()
})

it('reconciles newer revisions automatically but reports actual request failures', async () => {
  const { options, apply, edit } = fixture()
  const disconnect = connectWorkspaceLayout(options)
  await options.lane.current
  const external = {
    ...options.host.exportLayout(),
    sidebarWidths: { left: 800, right: 520 },
  }
  apply({ action: 'save', conversationId: 'chat', revision: 0, layout: external })
  edit(600)
  edit(650)
  await options.lane.current
  expect(options.host.exportLayout()).toEqual(external)
  expect(options.request.mock.calls.filter(([request]) => request.action === 'save')).toHaveLength(
    1,
  )
  expect(options.onStatus).toHaveBeenLastCalledWith({ message: '', retry: false })
  options.request.mockRejectedValueOnce(new Error('Offline'))
  edit(700)
  await options.lane.current
  expect(options.onStatus).toHaveBeenLastCalledWith({ message: 'Offline', retry: true })
  edit(720)
  await options.lane.current
  expect(options.onStatus).toHaveBeenLastCalledWith({ message: '', retry: false })
  disconnect()
})
