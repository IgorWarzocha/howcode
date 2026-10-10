import { useEffect, useState } from 'react'
import { piGuiThemeUpdatedEvent } from '../../../shared/gui-theme'
import { isSafeMermaidSource, renderMermaid } from './mermaid-render'

const accessibleTitle = /^\s*accTitle:\s*(.+)$/m

type DiagramState = { status: 'pending' } | { status: 'ready'; svg: string } | { status: 'failed' }

function MermaidResult({ source }: { source: string }) {
  const [state, setState] = useState<DiagramState>({ status: 'pending' })
  useEffect(() => {
    let controller: AbortController | undefined
    function render() {
      controller?.abort()
      const pending = new AbortController()
      controller = pending
      void renderMermaid(source, pending.signal).then(
        (svg) => {
          if (!pending.signal.aborted) setState({ status: 'ready', svg })
        },
        () => {
          if (!pending.signal.aborted) setState({ status: 'failed' })
        },
      )
    }
    render()
    window.addEventListener(piGuiThemeUpdatedEvent, render)
    return () => {
      window.removeEventListener(piGuiThemeUpdatedEvent, render)
      controller?.abort()
    }
  }, [source])

  return (
    <figure className="my-3 min-w-0">
      {state.status === 'ready' ? (
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(state.svg)}`}
          alt={accessibleTitle.exec(source)?.[1]?.trim() || 'Mermaid diagram'}
          className="mx-auto block h-auto max-h-[36rem] max-w-full"
        />
      ) : (
        <p className="text-sm text-[color:var(--muted)]" role="status">
          {state.status === 'pending'
            ? 'Rendering diagram…'
            : 'Diagram unavailable; source shown below.'}
        </p>
      )}
    </figure>
  )
}

// The transcript owner owns source disclosure and calls this only after the fence closes.
export function InlineMermaid({ source }: { source: string }) {
  if (!isSafeMermaidSource(source)) {
    return (
      <p className="text-sm text-[color:var(--muted)]">
        Diagram unavailable; read the source below.
      </p>
    )
  }
  return <MermaidResult key={source} source={source} />
}
