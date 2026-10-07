import type { PluginKeybindingPolicy } from '@howcode/extensions/keybinding-policy'

export const terminalPlugin = {
  id: 'terminal',
  keybindings: [
    { id: 'terminal.toggle', layer: 'settings' },
    { id: 'terminal.focus', renderer: true, layer: 'modal' },
    {
      id: 'terminal.clear',
      renderer: true,
      allowFromTextInput: ({ terminalVisible }) => terminalVisible,
    },
  ] satisfies PluginKeybindingPolicy[],
} as const
