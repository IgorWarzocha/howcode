export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'ready'
  | 'restarting'
  | 'error'

export type AppUpdateState = {
  status: AppUpdateStatus
  currentVersion: string
  latestVersion: string | null
  channel: 'main' | 'dev' | null
  error: string | null
}
