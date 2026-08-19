import { useState } from 'react'
import type { ComposerState, PiExtensionUiState } from '../desktop/types'

export function useAppShellComposerState() {
  const [state, setState] = useState<ComposerState | null>(null)
  const [extensionUiBySession, setExtensionUiBySession] = useState<
    Record<string, PiExtensionUiState>
  >({})

  return { extensionUiBySession, setExtensionUiBySession, setState, state }
}
