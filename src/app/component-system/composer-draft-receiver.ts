import type {
  ComposerDraftReceiver,
  RegisterComposerDraftReceiver,
} from '@howaboua/howcode-sdk/composer-renderer'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type ComposerDraftReceiverHost = {
  receiver: ComposerDraftReceiver | null
  register: RegisterComposerDraftReceiver
}

export const ComposerDraftReceiverContext = createContext<ComposerDraftReceiverHost | null>(null)

export function useComposerDraftReceiverHost(): ComposerDraftReceiverHost {
  const [receiver, setReceiver] = useState<ComposerDraftReceiver | null>(null)
  const register = useCallback<RegisterComposerDraftReceiver>((next) => {
    setReceiver(next)
    return () => setReceiver((current) => (current === next ? null : current))
  }, [])
  return useMemo(() => ({ receiver, register }), [receiver, register])
}

export function useComposerDraftReceiver() {
  const host = useContext(ComposerDraftReceiverContext)
  if (!host) throw new Error('Composer draft receiver host is unavailable.')
  return host
}
