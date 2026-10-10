export type {
  ArchivedChat,
  Chat,
  Message,
  WorkingDirectory,
} from '@howcode/shared/desktop-contracts.js'

export const builtInPagePaths = {
  landing: '/',
  workspace: '/workspaces',
  inbox: '/inbox',
  directories: '/workspaces',
  directory: '/workspaces',
  chat: '/chats',
  archived: '/archived',
  history: '/history',
  settings: '/settings',
  skills: '/skills',
} as const

export type BuiltInView = keyof typeof builtInPagePaths
export type ComponentView = `component:${string}`
export type View = BuiltInView | ComponentView

export function isBuiltInView(view: string): view is BuiltInView {
  return Object.hasOwn(builtInPagePaths, view)
}
