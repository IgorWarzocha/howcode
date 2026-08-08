import { type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import { useLatestRef } from '../../hooks/useLatestRef'
import type { GitOpsCommitOutcome } from './composer-primary-action'

type GitOpsMessageStatus = {
  errorMessage: string | null
  setErrorMessage: (message: string | null) => void
  setStatusMessage: (message: string | null) => void
  statusMessage: string | null
}

export function useGitOpsMessage({
  isTreeClean,
  projectId,
  setPreviewPending,
  status,
}: {
  isTreeClean: boolean
  projectId: string | null
  setPreviewPending: (pending: boolean) => void
  status: GitOpsMessageStatus
}) {
  const { errorMessage, setErrorMessage, setStatusMessage, statusMessage } = status
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [persistedCleanMessage, setPersistedCleanMessage] = useState<string | null>(null)
  const previousProjectIdRef = useRef<string | null>(projectId)
  const valueRef = useLatestRef(value)

  useEffect(() => {
    if (previousProjectIdRef.current === projectId) return
    previousProjectIdRef.current = projectId
    setValue('')
    setFocused(false)
    setPersistedCleanMessage(null)
    setPreviewPending(false)
    setStatusMessage(null)
  }, [projectId, setPreviewPending, setStatusMessage])

  if (!isTreeClean && persistedCleanMessage && value === persistedCleanMessage) {
    setValue('')
    setPersistedCleanMessage(null)
    setStatusMessage(null)
  }

  const onChange = useCallback(
    (nextValue: string) => {
      setValue(nextValue)
      if (errorMessage) setErrorMessage(null)
      if (statusMessage) setStatusMessage(null)
      if (nextValue.trim().length === 0) setPreviewPending(false)
      if (persistedCleanMessage && nextValue !== persistedCleanMessage) {
        setPersistedCleanMessage(null)
      }
    },
    [
      errorMessage,
      persistedCleanMessage,
      setErrorMessage,
      setPreviewPending,
      setStatusMessage,
      statusMessage,
    ],
  )

  const setValueAction = useCallback(
    (action: SetStateAction<string>) => {
      onChange(typeof action === 'function' ? action(valueRef.current) : action)
    },
    [onChange, valueRef],
  )

  const applyCommitOutcome = useCallback(
    (outcome: GitOpsCommitOutcome) => {
      if (outcome.nextMessage) {
        setValue(outcome.nextMessage)
        setFocused(false)
      }
      if (outcome.previewed) setPreviewPending(true)
      if (outcome.committed) {
        setPreviewPending(false)
        if (outcome.persistedMessage) {
          setValue(outcome.persistedMessage)
          setPersistedCleanMessage(outcome.persistedMessage)
        }
        setStatusMessage(outcome.statusMessage)
      }
      setErrorMessage(outcome.errorMessage)
    },
    [setErrorMessage, setPreviewPending, setStatusMessage],
  )

  return {
    applyCommitOutcome,
    field: {
      focused,
      onChange,
      setFocused,
      setValue: setValueAction,
      value,
    },
    trimmedValue: value.trim(),
  }
}
