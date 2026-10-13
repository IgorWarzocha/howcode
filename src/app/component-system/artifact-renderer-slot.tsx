import type {
  ArtifactComposerControlProps,
  ArtifactPanelProps,
} from '@howaboua/howcode-sdk/artifacts-renderer'
import { useArtifactRenderers } from './installed-renderer-context'
import { RendererSlot } from './renderer-slots'

export function InstalledArtifactPanel(
  props: ArtifactPanelProps & { rendererName: string | null },
) {
  const renderer = useArtifactRenderers().find(({ name }) => name === props.rendererName)
  const Panel = renderer?.contribution.artifacts?.Panel
  return renderer && Panel ? (
    <RendererSlot name={renderer.name}>
      <Panel {...props} host={renderer.host} />
    </RendererSlot>
  ) : null
}

export function InstalledArtifactComposerControl({
  rendererName,
  onToggleRenderer,
  ...props
}: ArtifactComposerControlProps & {
  rendererName?: string | null
  onToggleRenderer?: (name: string) => void
}) {
  const renderers = useArtifactRenderers()
  return (
    <>
      {renderers.map((renderer) => {
        const Control = renderer.contribution.artifacts?.ComposerControl
        return Control ? (
          <RendererSlot key={renderer.name} name={renderer.name}>
            <Control
              {...props}
              visible={props.visible && rendererName === renderer.name}
              onToggle={onToggleRenderer ? () => onToggleRenderer(renderer.name) : props.onToggle}
              host={renderer.host}
            />
          </RendererSlot>
        ) : null
      })}
    </>
  )
}
