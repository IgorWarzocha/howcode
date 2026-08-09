import { useRef } from 'react'
import type { ComposerProps } from './composer-contract'
import { ComposerPromptSurface } from './composer-prompt-surface'

export type { ComposerProps } from './composer-contract'

export function Composer(props: ComposerProps) {
  const composerPanelRef = useRef<HTMLDivElement>(null)

  return (
    <ComposerPromptSurface
      {...props}
      composerPanelRef={composerPanelRef}
      workspaceFooterRef={props.workspaceFooterRef}
      onOpenGitOps={props.onOpenGitOpsView}
    />
  )
}
