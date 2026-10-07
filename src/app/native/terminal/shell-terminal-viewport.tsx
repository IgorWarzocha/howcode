import { type SharedTerminalViewportProps, TerminalViewportBase } from './terminal-viewport-base'

type ShellTerminalViewportProps = SharedTerminalViewportProps & {
  hoverToFocus?: boolean
  hoverToBlur?: boolean
}

export function ShellTerminalViewport({
  hoverToFocus = true,
  hoverToBlur = false,
  ...props
}: ShellTerminalViewportProps) {
  return <TerminalViewportBase {...props} hoverToFocus={hoverToFocus} hoverToBlur={hoverToBlur} />
}
