import { type SharedTerminalViewportProps, TerminalViewportBase } from './terminal-viewport-base'
import { DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT } from './terminalViewportUtils'

type PiTuiViewportProps = SharedTerminalViewportProps & {
  keepAliveMsOnUnmount?: number
  closeWhenSessionFileIdleMs?: number
  maxKeepAliveMsOnUnmount?: number
}

export function PiTuiViewport({
  keepAliveMsOnUnmount = 0,
  closeWhenSessionFileIdleMs = 0,
  maxKeepAliveMsOnUnmount = DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT,
  ...props
}: PiTuiViewportProps) {
  return (
    <TerminalViewportBase
      {...props}
      mode="pi-session"
      keepAliveMsOnUnmount={keepAliveMsOnUnmount}
      closeWhenSessionFileIdleMs={closeWhenSessionFileIdleMs}
      maxKeepAliveMsOnUnmount={maxKeepAliveMsOnUnmount}
    />
  )
}
