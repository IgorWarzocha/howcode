import { TerminalViewportBase, type TerminalViewportBaseProps } from './terminal-viewport-base'

type ShellTerminalViewportProps = Omit<TerminalViewportBaseProps, 'launchMode'>

export function ShellTerminalViewport(props: ShellTerminalViewportProps) {
  return <TerminalViewportBase {...props} launchMode="shell" />
}
