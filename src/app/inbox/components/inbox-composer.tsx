import { InboxComposerSurface } from './inbox-composer-surface'
import type { InboxComposerProps } from './inbox-composer-types'
import { useInboxComposerActions } from './useInboxComposerActions'
import { useInboxComposerAutocomplete } from './useInboxComposerAutocomplete'
import { useInboxComposerInput } from './useInboxComposerInput'
import { useInboxComposerOverlayState } from './useInboxComposerOverlayState'

export function InboxComposer(props: InboxComposerProps) {
  const overlay = useInboxComposerOverlayState()
  const input = useInboxComposerInput(props, overlay)
  const actions = useInboxComposerActions(props, input, overlay)
  const autocomplete = useInboxComposerAutocomplete(props, input, actions, overlay)

  return (
    <InboxComposerSurface
      actions={actions}
      autocomplete={autocomplete}
      input={input}
      overlay={overlay}
      props={props}
    />
  )
}
