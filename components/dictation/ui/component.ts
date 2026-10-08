import type { ComponentKeybindingPolicy } from '@howcode/component-system/keybinding-policy'

export const dictationComponent = {
  id: 'dictation',
  keybindings: [
    {
      id: 'dictation.toggle',
      renderer: true,
      allowFromTextInput: ({ composerTarget, activeView }) =>
        composerTarget || activeView === 'inbox',
    },
  ] satisfies ComponentKeybindingPolicy[],
} as const
