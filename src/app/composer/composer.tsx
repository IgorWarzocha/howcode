import { useRef } from 'react'
import { useToolkitComponentEnabled } from '../component-system/component-context'
import type { ComposerProps } from './composer-contract'
import { ComposerPromptSurface } from './composer-prompt-surface'

export type { ComposerProps } from './composer-contract'

export function Composer(props: ComposerProps) {
  const dictationEnabled = useToolkitComponentEnabled('dictation')
  const composerPanelRef = useRef<HTMLDivElement>(null)

  return (
    <ComposerPromptSurface
      {...props}
      showDictationButton={dictationEnabled && props.showDictationButton}
      composerPanelRef={composerPanelRef}
      workspaceFooterRef={props.workspaceFooterRef}
      onOpenGitOps={props.onOpenGitOpsView}
    />
  )
}
