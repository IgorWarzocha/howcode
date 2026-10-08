import { composerOverlayPanelInsetClass } from '@howcode/ui/classes'
import type { RefObject } from 'react'
import { ComposerFilePicker } from './composer-file-picker'
import { ComposerOverlayStack } from './composer-overlay-stack'
import { ComposerPromptPopoverStack } from './composer-prompt-popover-stack'

type AttachmentOverlay = Parameters<typeof ComposerFilePicker>[0] & {
  topRounded: boolean
  visible: boolean
}

type PromptPopoverOverlay = Parameters<typeof ComposerPromptPopoverStack>[0] & {
  visible: boolean
}

export function ComposerPromptOverlays({
  attachments,
  prompts,
  stackRef,
}: {
  attachments: AttachmentOverlay
  prompts: PromptPopoverOverlay
  stackRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <ComposerOverlayStack
      stackRef={stackRef}
      items={[
        {
          id: 'attachments',
          visible: attachments.visible,
          node: (
            <div className={composerOverlayPanelInsetClass}>
              <ComposerFilePicker
                {...attachments}
                embedded
                embeddedTopRounded={attachments.topRounded}
              />
            </div>
          ),
        },
        {
          id: 'input-popovers',
          visible: prompts.visible,
          node: <ComposerPromptPopoverStack {...prompts} embedded />,
        },
      ]}
    />
  )
}
