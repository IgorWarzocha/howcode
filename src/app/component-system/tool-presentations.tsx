import type { ToolResultMessage } from '@howaboua/howcode-sdk/chat-renderer'
import type {
  ToolPresentationProps,
  ToolPresentationResolution,
} from '@howaboua/howcode-sdk/tool-renderer'
import { useCallback, useContext } from 'react'
import { type Renderer, RendererHostsContext } from './installed-renderer-context'
import { RendererSlot } from './renderer-slots'

function describePresentation(
  renderer: Renderer,
  message: ToolResultMessage,
): ToolPresentationResolution | null {
  const presentations = renderer.contribution.toolPresentations
  if (!(presentations && Object.hasOwn(presentations, message.toolName))) return null
  const presentation = presentations[message.toolName]
  if (!presentation) return null
  try {
    const summary = presentation.summarize(message)
    if (!summary) return null
    if (
      typeof summary.title !== 'string' ||
      !summary.title.trim() ||
      (summary.activityTitle !== undefined &&
        (typeof summary.activityTitle !== 'string' || !summary.activityTitle.trim())) ||
      (summary.description !== undefined && typeof summary.description !== 'string')
    )
      throw new Error('Invalid tool presentation summary.')
    return { status: 'ready', owner: renderer.name, summary }
  } catch (error) {
    return {
      status: 'error',
      message: `${renderer.name}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export function useDescribeToolPresentation() {
  const renderers = useContext(RendererHostsContext)
  return useCallback(
    (message: ToolResultMessage): ToolPresentationResolution | null => {
      let match: Extract<ToolPresentationResolution, { status: 'ready' }> | null = null
      for (const renderer of renderers) {
        const result = describePresentation(renderer, message)
        if (!result) continue
        if (result.status === 'error') return result
        if (match)
          return {
            status: 'error',
            message: `Multiple components render ${message.toolName}: ${match.owner}, ${renderer.name}.`,
          }
        match = result
      }
      return match
    },
    [renderers],
  )
}

export function InstalledToolPresentation({
  owner,
  ...props
}: ToolPresentationProps & { owner: string }) {
  const renderer = useContext(RendererHostsContext).find((entry) => entry.name === owner)
  const presentations = renderer?.contribution.toolPresentations
  const Content =
    presentations && Object.hasOwn(presentations, props.message.toolName)
      ? presentations[props.message.toolName]?.Content
      : undefined
  if (!(renderer && Content)) return <p role="status">Tool presentation unavailable.</p>
  return (
    <RendererSlot name={owner}>
      <Content {...props} host={renderer.host} />
    </RendererSlot>
  )
}
