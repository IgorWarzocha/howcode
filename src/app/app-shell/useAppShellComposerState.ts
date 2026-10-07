import { useState } from 'react'
import type { ComposerState } from '../desktop/types'

export function useAppShellComposerState() {
  const [state, setState] = useState<ComposerState | null>(null)

  return { setState, state }
}
