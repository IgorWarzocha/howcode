import { RetainedWorkspaceSurface } from '@howaboua/howcode-sdk/workspace-surfaces'
import { type ComponentProps, createContext, type ReactNode, useContext, useMemo } from 'react'

const RendererStyleOwner = createContext<string | null>(null)

export function RendererStyleScope({ name, children }: { name: string; children: ReactNode }) {
  return (
    <RendererStyleOwner value={name}>
      <div data-howcode-component={name} style={{ display: 'contents' }}>
        {children}
      </div>
    </RendererStyleOwner>
  )
}

export function RendererPortalScope({ children }: { children: ReactNode }) {
  const name = useContext(RendererStyleOwner)
  return name ? <RendererStyleScope name={name}>{children}</RendererStyleScope> : children
}

/** The shared SDK portals these nodes itself, outside the renderer's ReactDOM bridge. */
export function RendererRetainedWorkspaceSurface(
  props: ComponentProps<typeof RetainedWorkspaceSurface>,
) {
  const name = useContext(RendererStyleOwner)
  const { content, actions } = props
  // Metadata effects consume node identity; don't republish unchanged surface actions.
  const scoped = useMemo(
    () => ({
      content: name ? <RendererStyleScope name={name}>{content}</RendererStyleScope> : content,
      actions:
        name && actions ? <RendererStyleScope name={name}>{actions}</RendererStyleScope> : actions,
    }),
    [name, content, actions],
  )
  return <RetainedWorkspaceSurface {...props} {...scoped} />
}
