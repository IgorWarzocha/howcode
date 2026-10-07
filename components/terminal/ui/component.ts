import type { ComponentKeybindingPolicy } from '@howcode/component-system/keybinding-policy'

export const terminalComponent = {
  id: 'terminal',
  keybindings: [
    { id: 'terminal.toggle', layer: 'settings' },
    { id: 'terminal.focus', renderer: true, layer: 'modal' },
    {
      id: 'terminal.clear',
      renderer: true,
      allowFromTextInput: ({ terminalVisible }) => terminalVisible,
    },
  ] satisfies ComponentKeybindingPolicy[],
} as const
