import type { PluginKeybindingPolicy } from '@howcode/extensions/keybinding-policy'

export const dictationPlugin = {
  id: 'dictation',
  keybindings: [
    {
      id: 'dictation.toggle',
      renderer: true,
      allowFromTextInput: ({ composerTarget, activeView }) =>
        composerTarget || activeView === 'gitops' || activeView === 'inbox',
    },
  ] satisfies PluginKeybindingPolicy[],
} as const
