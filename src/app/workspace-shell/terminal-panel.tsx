import { memo } from 'react'
import { PiTuiTakeoverPanel, type PiTuiTakeoverPanelProps } from './pi-tui-takeover-panel'
import { ShellTerminalPanel, type ShellTerminalPanelProps } from './shell-terminal-panel'

type TerminalPanelProps =
  | (PiTuiTakeoverPanelProps & { mode: 'takeover' })
  | (ShellTerminalPanelProps & { mode?: 'drawer' })

function TerminalPanelComponent(props: TerminalPanelProps) {
  if (props.mode === 'takeover') {
    return <PiTuiTakeoverPanel {...props} />
  }

  return <ShellTerminalPanel {...props} />
}

export const TerminalPanel = memo(TerminalPanelComponent)
