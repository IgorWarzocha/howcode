import type { ComposerActionContext } from '@howaboua/howcode-sdk/composer-renderer'
import type { PluginRendererContribution, PluginRendererHost } from '@howaboua/howcode-sdk/plugins'
import { useContext, useLayoutEffect, useState } from 'react'
import { RendererHostsContext } from './installed-renderer-context'
import { RendererSlot } from './renderer-slots'

type DraftMutations = Pick<ComposerActionContext, 'appendText' | 'addAttachments'>

/** Revocation belongs to the action's mounted generation, not the shared editor. */
function ComposerAction({
  Actions,
  host,
  composer,
}: {
  Actions: NonNullable<PluginRendererContribution['ComposerActions']>
  host: PluginRendererHost
  composer: ComposerActionContext
}) {
  const { appendText, addAttachments } = composer
  const [mutations, setMutations] = useState<DraftMutations | null>(null)
  useLayoutEffect(() => {
    let active = true
    setMutations({
      appendText: (text) => active && appendText(text),
      addAttachments: (attachments) => active && addAttachments(attachments),
    })
    return () => {
      active = false
    }
  }, [appendText, addAttachments])
  return mutations ? <Actions host={host} composer={{ ...composer, ...mutations }} /> : null
}

export function InstalledComposerActions({ composer }: { composer: ComposerActionContext }) {
  const renderers = useContext(RendererHostsContext)
  return renderers.map(({ name, host, contribution, reference }) => {
    const Actions = contribution.ComposerActions
    return Actions && host.enabled ? (
      <RendererSlot key={`${name}@${reference?.revision ?? ''}`} name={name}>
        <ComposerAction Actions={Actions} host={host} composer={composer} />
      </RendererSlot>
    ) : null
  })
}
