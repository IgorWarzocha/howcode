import { useState } from 'react'
import type { PiResourcePendingAction } from './types'

function actionsMatch(left: PiResourcePendingAction, right: PiResourcePendingAction) {
  return left.kind === right.kind && left.source === right.source
}

export function usePiResourcePendingActions() {
  const [pendingActions, setPendingActions] = useState<PiResourcePendingAction[]>([])

  const startPendingAction = (action: PiResourcePendingAction) => {
    setPendingActions((current) => [...current, action])
  }

  const finishPendingAction = (action: PiResourcePendingAction) => {
    setPendingActions((current) => current.filter((candidate) => !actionsMatch(candidate, action)))
  }

  const isPendingAction = (kind: PiResourcePendingAction['kind'], source: string) => {
    const normalizedSource = source.trim().toLowerCase()
    return pendingActions.some(
      (action) => action.kind === kind && action.source.trim().toLowerCase() === normalizedSource,
    )
  }

  return {
    finishPendingAction,
    hasPendingInstall: pendingActions.some((action) => action.kind === 'install'),
    isPendingAction,
    startPendingAction,
  }
}
