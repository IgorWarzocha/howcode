import type { KeybindingCommandId } from '@howcode/shared/keybindings'
import type { View } from '../types'

export type PluginKeybindingPolicy = {
  id: KeybindingCommandId
  renderer?: boolean
  layer?: 'modal' | 'settings'
  allowFromTextInput?: (context: {
    composerTarget: boolean
    activeView: View
    terminalVisible: boolean
  }) => boolean
}
