import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { getErrorMessage } from '../../../desktop/error-messages'
import type { DictationState } from '../../../desktop/types'
import {
  appendDictatedText,
  canUseLocalDictationCapture,
  type LocalDictationCaptureSession,
  startLocalDictationCapture,
} from './local-dictation'

type DictationSessionIdentity = {
  scopeKey: string
  token: number
}

type DictationRefs = {
  activeScopeKeyRef: React.MutableRefObject<string>
  flushPromiseRef: React.MutableRefObject<Promise<void> | null>
  sessionTokenRef: React.MutableRefObject<number>
}

function isCurrentDictationSession(refs: DictationRefs, identity: DictationSessionIdentity) {
  return (
    refs.activeScopeKeyRef.current === identity.scopeKey &&
    refs.sessionTokenRef.current === identity.token
  )
}

function setDictationTranscribing(input: {
  setDictationActive: Dispatch<SetStateAction<boolean>>
  setDictationInterimText: Dispatch<SetStateAction<string>>
}) {
  input.setDictationActive(false)
  input.setDictationInterimText('Transcribing…')
}

async function transcribeCapturedAudio(input: {
  capture: LocalDictationCaptureSession
  identity: DictationSessionIdentity
  refs: DictationRefs
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
}) {
  const audio = await input.capture.stop()
  if (!isCurrentDictationSession(input.refs, input.identity)) return
  if (!audio.audioBase64) {
    input.setErrorMessage('No speech was captured.')
    return
  }
  if (!window.piDesktop?.transcribeDictation) {
    input.setErrorMessage('Local dictation is unavailable in this runtime.')
    return
  }
  const result = await window.piDesktop.transcribeDictation({
    audioBase64: audio.audioBase64,
    sampleRate: audio.sampleRate,
    language: navigator.language || null,
  })
  if (!isCurrentDictationSession(input.refs, input.identity)) return
  if (!result.ok) {
    input.setErrorMessage(result.error ?? 'Could not transcribe dictation.')
    return
  }
  if (result.text.trim()) {
    input.setDraftValue((current) => appendDictatedText(current, result.text))
    input.setErrorMessage(null)
  }
}

async function readDictationAvailability(
  currentState: DictationState | null,
  setErrorMessage: Dispatch<SetStateAction<string | null>>,
) {
  const getDictationState = window.piDesktop?.getDictationState
  if (!getDictationState) return currentState
  try {
    return await getDictationState()
  } catch {
    setErrorMessage('Could not verify local dictation availability in this runtime.')
    return 'unavailable'
  }
}

function getUnavailableDictationToggleResult(
  availability: DictationState | null,
  setErrorMessage: Dispatch<SetStateAction<string | null>>,
) {
  if (!(availability && !availability.available)) return null
  if (availability.reason === 'missing-model') {
    setErrorMessage(null)
    return 'setup-required' as const
  }
  setErrorMessage(availability.error ?? 'Local dictation is unavailable in this runtime.')
  return 'unavailable' as const
}

type UseComposerDictationProps = {
  activeView: string
  dictationModelId: string | null
  dictationMaxDurationSeconds: number
  draftThreadId: string | null
  projectId: string
  sessionPath: string | null
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
}

export function useComposerDictation({
  activeView,
  dictationModelId,
  dictationMaxDurationSeconds,
  draftThreadId,
  projectId,
  sessionPath,
  setDraftValue,
  setErrorMessage,
}: UseComposerDictationProps) {
  const dictationCaptureRef = useRef<LocalDictationCaptureSession | null>(null)
  const [dictationActive, setDictationActive] = useState(false)
  const [dictationInterimText, setDictationInterimText] = useState('')
  const [dictationState, setDictationState] = useState<DictationState | null>(null)
  const dictationSessionTokenRef = useRef(0)
  const dictationFlushPromiseRef = useRef<Promise<void> | null>(null)
  const dictationScopeKey = useMemo(
    () => `${activeView}::${projectId}::${sessionPath ?? ''}::${draftThreadId ?? ''}`,
    [activeView, draftThreadId, projectId, sessionPath],
  )
  const activeDictationScopeKeyRef = useRef(dictationScopeKey)

  activeDictationScopeKeyRef.current = dictationScopeKey

  const clearPendingDictationFlush = useCallback(() => {
    dictationFlushPromiseRef.current = null
  }, [])

  const clearDictationSession = useCallback(() => {
    dictationCaptureRef.current = null
    setDictationActive(false)
    setDictationInterimText('')
  }, [])

  const abortDictationSession = useCallback(() => {
    dictationSessionTokenRef.current += 1
    clearPendingDictationFlush()

    const capture = dictationCaptureRef.current
    if (!capture) {
      clearDictationSession()
      return
    }

    void capture.abort().catch(() => undefined)
    clearDictationSession()
  }, [clearDictationSession, clearPendingDictationFlush])

  const stopDictationAndFlush = useCallback(async () => {
    if (dictationFlushPromiseRef.current) {
      await dictationFlushPromiseRef.current
      return
    }

    const capture = dictationCaptureRef.current
    if (!capture) {
      return
    }

    dictationCaptureRef.current = null

    const identity = {
      scopeKey: activeDictationScopeKeyRef.current,
      token: dictationSessionTokenRef.current,
    }
    const refs = {
      activeScopeKeyRef: activeDictationScopeKeyRef,
      flushPromiseRef: dictationFlushPromiseRef,
      sessionTokenRef: dictationSessionTokenRef,
    }
    const flushPromise = (async () => {
      setDictationTranscribing({ setDictationActive, setDictationInterimText })
      try {
        await transcribeCapturedAudio({ capture, identity, refs, setDraftValue, setErrorMessage })
      } catch (error) {
        if (isCurrentDictationSession(refs, identity)) {
          setErrorMessage(getErrorMessage(error, 'Could not stop local dictation.'))
        }
      } finally {
        dictationFlushPromiseRef.current = null
        if (isCurrentDictationSession(refs, identity)) clearDictationSession()
      }
    })()

    dictationFlushPromiseRef.current = flushPromise
    await flushPromise
  }, [clearDictationSession, setDraftValue, setErrorMessage])

  useEffect(() => {
    void dictationScopeKey
    abortDictationSession()
  }, [abortDictationSession, dictationScopeKey])

  useEffect(() => abortDictationSession, [abortDictationSession])

  useEffect(() => {
    let disposed = false

    void dictationModelId

    if (!window.piDesktop?.getDictationState) {
      return
    }

    void window.piDesktop
      .getDictationState()
      .then((state) => {
        if (!disposed) {
          setDictationState(state)
        }
      })
      .catch(() => {
        if (!disposed) {
          setDictationState(null)
        }
      })

    return () => {
      disposed = true
    }
  }, [dictationModelId])

  const dictationMissingModel = dictationState?.reason === 'missing-model'
  const dictationSupported = useMemo(
    () =>
      canUseLocalDictationCapture() &&
      typeof window.piDesktop?.transcribeDictation === 'function' &&
      (dictationState?.available ?? true),
    [dictationState],
  )

  const toggleDictation = async () => {
    if (dictationCaptureRef.current) {
      void stopDictationAndFlush()
      return 'stopped' as const
    }

    if (dictationFlushPromiseRef.current) {
      await dictationFlushPromiseRef.current
      return 'stopped' as const
    }

    if (!(canUseLocalDictationCapture() && window.piDesktop?.transcribeDictation)) {
      setErrorMessage('Local dictation is unavailable in this runtime.')
      return 'unavailable' as const
    }

    try {
      const availability = await readDictationAvailability(dictationState, setErrorMessage)
      if (availability === 'unavailable') return 'unavailable' as const
      if (availability) setDictationState(availability)
      const unavailableResult = getUnavailableDictationToggleResult(availability, setErrorMessage)
      if (unavailableResult) return unavailableResult

      const capture = await startLocalDictationCapture(dictationMaxDurationSeconds)
      dictationSessionTokenRef.current += 1
      dictationCaptureRef.current = capture
      setDictationActive(true)
      setDictationInterimText('')
      setErrorMessage(null)
      return 'started' as const
    } catch (error) {
      clearDictationSession()
      setErrorMessage(getErrorMessage(error, 'Could not start local dictation.'))
      return 'unavailable' as const
    }
  }

  const cancelDictation = useCallback(async () => {
    if (dictationCaptureRef.current) {
      abortDictationSession()
      return
    }

    if (dictationFlushPromiseRef.current) {
      const pendingFlush = dictationFlushPromiseRef.current
      dictationSessionTokenRef.current += 1
      clearPendingDictationFlush()
      clearDictationSession()
      await pendingFlush.catch(() => undefined)
    }
  }, [abortDictationSession, clearDictationSession, clearPendingDictationFlush])

  return {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    stopDictationAndFlush,
    toggleDictation,
  }
}
