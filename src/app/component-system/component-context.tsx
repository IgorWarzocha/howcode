import {
  isToolkitComponentEnabled,
  type ToolkitComponentId,
  type ToolkitComponentSettings,
} from '@howcode/shared/toolkit-components'
import { createContext, useContext } from 'react'

export const ComponentSettingsContext = createContext<ToolkitComponentSettings | undefined>(
  undefined,
)

export function useToolkitComponentEnabled(id: ToolkitComponentId) {
  return isToolkitComponentEnabled(useContext(ComponentSettingsContext), id)
}
