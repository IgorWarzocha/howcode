import {
  isToolkitExtensionEnabled,
  type ToolkitExtensionId,
  type ToolkitExtensionSettings,
} from '@howcode/shared/toolkit-extensions'
import { createContext, useContext } from 'react'

export const ToolkitSettingsContext = createContext<ToolkitExtensionSettings | undefined>(undefined)

export function useToolkitExtensionEnabled(id: ToolkitExtensionId) {
  return isToolkitExtensionEnabled(useContext(ToolkitSettingsContext), id)
}
