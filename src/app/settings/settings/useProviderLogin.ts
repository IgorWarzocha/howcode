import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { ProviderAuthSession } from '../../../../shared/provider-auth'
import { providerAuthError, requestProviderLogin } from './providerAuthClient'

type LoginHandle = { sessionId: string | null; controller: AbortController }

async function cancelLogin(handle: LoginHandle) {
  handle.controller.abort()
  if (handle.sessionId)
    await requestProviderLogin({ operation: 'cancel', sessionId: handle.sessionId })
}

export function useProviderLogin(onComplete: () => void) {
  const owner = useRef<LoginHandle | null>(null)
  const pending = useRef(false)
  const [snapshot, setSession] = useState<ProviderAuthSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const accept = (next: ProviderAuthSession) =>
    setSession((current) =>
      current?.sessionId === next.sessionId && current.revision > next.revision ? current : next,
    )

  useEffect(
    () => () => {
      const handle = owner.current
      if (handle)
        void cancelLogin(handle).catch(() => {
          /* The server lease expires if transport is gone. */
        })
    },
    [],
  )

  const sessionId = snapshot?.sessionId
  const status = useQuery({
    queryKey: ['provider-login', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('No active login.')
      return requestProviderLogin({ operation: 'read', sessionId })
    },
    enabled: snapshot?.status === 'running',
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.error || query.state.data?.status !== 'running' ? false : 1000,
    refetchIntervalInBackground: true,
  })
  const session =
    status.data && snapshot && status.data.revision >= snapshot.revision ? status.data : snapshot
  const completed = session && session.status !== 'running'
  useEffect(() => {
    if (sessionId && completed) onComplete()
  }, [sessionId, completed, onComplete])
  useEffect(() => {
    const handle = owner.current
    if (status.error && handle)
      void cancelLogin(handle).catch(() => {
        /* The server lease bounds disconnected cleanup. */
      })
  }, [status.error])

  const start = async (provider: string, authType: 'api_key' | 'oauth') => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    const handle: LoginHandle = { sessionId: null, controller: new AbortController() }
    owner.current = handle
    try {
      const next = await requestProviderLogin({
        operation: 'start',
        provider,
        authType,
      })
      handle.sessionId = next.sessionId
      if (handle.controller.signal.aborted) {
        await cancelLogin(handle)
        return
      }
      accept(next)
    } catch (failure) {
      if (!handle.controller.signal.aborted) setError(providerAuthError(failure))
      void cancelLogin(handle).catch(() => {
        /* A lost start response is bounded by the server lease. */
      })
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const answer = async (value: string) => {
    if (pending.current || !session?.prompt) return false
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const next = await requestProviderLogin({
        operation: 'answer',
        sessionId: session.sessionId,
        promptId: session.prompt.id,
        value,
      })
      accept(next)
      return true
    } catch (failure) {
      setError(providerAuthError(failure))
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const cancel = async () => {
    const handle = owner.current
    if (!handle?.sessionId || pending.current) return
    pending.current = true
    setBusy(true)
    try {
      const next = await requestProviderLogin({ operation: 'cancel', sessionId: handle.sessionId })
      accept(next)
    } catch (failure) {
      setError(providerAuthError(failure))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return {
    session: status.error ? null : session,
    busy,
    error: status.error
      ? `${providerAuthError(status.error)} Sign-in stopped; if disconnected, the server releases it within a minute.`
      : error,
    start,
    answer,
    cancel,
  }
}
