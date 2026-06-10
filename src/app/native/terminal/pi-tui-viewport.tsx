import { TerminalViewportBase, type TerminalViewportBaseProps } from './terminal-viewport-base'

type PiTuiViewportProps = Omit<
  TerminalViewportBaseProps,
  | 'bottomAlignInitialContent'
  | 'hoverToBlur'
  | 'hoverToFocus'
  | 'launchMode'
  | 'preserveSessionOnUnmount'
  | 'stickToBottomOnOutput'
>

export function PiTuiViewport(props: PiTuiViewportProps) {
  return (
    <TerminalViewportBase
      {...props}
      launchMode="pi-session"
      hoverToFocus={false}
      hoverToBlur={false}
      preserveSessionOnUnmount={false}
      stickToBottomOnOutput={false}
    />
  )
}
