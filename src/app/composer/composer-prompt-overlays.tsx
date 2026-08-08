import type { RefObject } from 'react'
import { composerOverlayPanelInsetClass } from '../ui/classes'
import { ComposerFilePicker } from './composer-file-picker'
import { ComposerOverlayStack } from './composer-overlay-stack'
import { ComposerPiExtensionOverlay } from './composer-pi-extension-overlay'
import { ComposerPromptPopoverStack } from './composer-prompt-popover-stack'

type ExtensionOverlay = Parameters<typeof ComposerPiExtensionOverlay>[0] & {
  visible: boolean
}

type AttachmentOverlay = Parameters<typeof ComposerFilePicker>[0] & {
  topRounded: boolean
  visible: boolean
}

type PromptPopoverOverlay = Parameters<typeof ComposerPromptPopoverStack>[0] & {
  visible: boolean
}

export function ComposerPromptOverlays({
  attachments,
  extension,
  prompts,
  stackRef,
}: {
  attachments: AttachmentOverlay
  extension: ExtensionOverlay
  prompts: PromptPopoverOverlay
  stackRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <ComposerOverlayStack
      stackRef={stackRef}
      items={[
        {
          id: 'extensions',
          visible: extension.visible,
          node: <ComposerPiExtensionOverlay {...extension} />,
        },
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
