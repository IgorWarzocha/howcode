import { useContext } from 'react'
import { ComponentSettingsContext } from './component-context'
import { RendererHostsContext } from './installed-renderer-context'

/** Automatic selection is unambiguous only when exactly one capture owner is admitted. */
export function useDictationProviderSelection() {
  const selection = useContext(ComponentSettingsContext)?.dictationProvider ?? 'auto'
  const providers = useContext(RendererHostsContext).filter(
    ({ contribution, host }) => host.enabled && contribution.draftInput,
  )
  const renderer =
    selection === 'auto'
      ? providers.length === 1
        ? providers[0]
        : undefined
      : selection === 'none'
        ? undefined
        : providers.find(({ name }) => name === selection)
  const error =
    selection === 'auto' && providers.length > 1
      ? 'Multiple dictation components are installed. Choose one in Chat settings.'
      : selection !== 'auto' && selection !== 'none' && !renderer
        ? `Dictation component unavailable: ${selection}. Choose another in Chat settings.`
        : null
  return { selection, providers, renderer, error }
}
