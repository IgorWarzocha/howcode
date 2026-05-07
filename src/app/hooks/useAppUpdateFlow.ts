import { useCallback, useEffect, useMemo, useState } from 'react'
import packageJson from '../../../package.json'
import type { AppUpdateState } from '../desktop/types'
import {
  checkAppUpdateQuery,
  getAppUpdateStateQuery,
  installAppUpdateQuery,
  restartAppUpdateQuery,
} from '../query/desktop-query'

const fallbackUpdateState: AppUpdateState = {
  status: 'idle',
  currentVersion: packageJson.version,
  latestVersion: null,
  error: null,
}

function getUpdateLabel(state: AppUpdateState) {
  const latestVersion = state.latestVersion ?? state.currentVersion
  if (state.status === 'up-to-date' || state.status === 'idle') return `${latestVersion} latest`
  if (state.status === 'checking') return 'Checking for updates…'
  if (state.status === 'available') return `Update ${latestVersion} available`
  if (state.status === 'downloading') return 'Downloading update…'
  if (state.status === 'installing') return 'Installing update…'
  if (state.status === 'ready') return `Update ${latestVersion} ready`
  if (state.status === 'restarting') return 'Restarting…'
  return 'Update check failed'
}

function getUpdateAction(state: AppUpdateState) {
  if (state.status === 'available') return 'Update'
  if (state.status === 'ready') return 'Restart'
  if (state.status === 'error') return 'Retry'
  return 'Check'
}

export function useAppUpdateFlow() {
  const [state, setState] = useState<AppUpdateState>(fallbackUpdateState)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.piDesktop?.subscribe?.((event) => {
      if (event.type === 'app-update') setState(event.state)
    })
    void getAppUpdateStateQuery().then((nextState) => {
      if (!cancelled && nextState) setState(nextState)
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const advance = useCallback(async () => {
    const nextState =
      state.status === 'available'
        ? await installAppUpdateQuery()
        : state.status === 'ready'
          ? await restartAppUpdateQuery()
          : await checkAppUpdateQuery()
    if (nextState) setState(nextState)
  }, [state.status])

  const isRunning =
    state.status === 'checking' ||
    state.status === 'downloading' ||
    state.status === 'installing' ||
    state.status === 'restarting'
  const step = useMemo(
    () => ({ id: state.status, label: getUpdateLabel(state), action: getUpdateAction(state) }),
    [state],
  )

  return { step, state, isRunning, advance }
}
