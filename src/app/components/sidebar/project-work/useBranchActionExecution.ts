import { useState } from 'react'
import type { DesktopActionResult } from '../../../desktop/types'

type BranchActionExecutionState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'failed'; warning: string }

type BranchActionRequest<Result> = {
  execute: () => Promise<Result>
  getFailure: (result: Result) => string | null
  onSuccess?: (() => void) | undefined
}

export function getDesktopBranchActionFailure(
  result: DesktopActionResult | null,
  fallback: string,
) {
  const error = result?.result?.error?.trim()
  if (error) return error
  return result?.ok ? null : fallback
}

function getThrownBranchActionFailure(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Action failed.'
}

export function useBranchActionExecution() {
  const [state, setState] = useState<BranchActionExecutionState>({ status: 'idle' })

  const clearWarning = () => {
    setState((current) => (current.status === 'failed' ? { status: 'idle' } : current))
  }

  const run = async <Result>({ execute, getFailure, onSuccess }: BranchActionRequest<Result>) => {
    setState({ status: 'pending' })
    try {
      const result = await execute()
      const failure = getFailure(result)
      if (failure) {
        setState({ status: 'failed', warning: failure })
        return
      }
      setState({ status: 'idle' })
      onSuccess?.()
    } catch (error) {
      setState({ status: 'failed', warning: getThrownBranchActionFailure(error) })
    }
  }

  return {
    clearWarning,
    pending: state.status === 'pending',
    run,
    warning: state.status === 'failed' ? state.warning : null,
  }
}
