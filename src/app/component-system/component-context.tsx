import {
  isToolkitComponentEnabled,
  type ToolkitComponentId,
  type ToolkitComponentSettings,
} from '@howcode/shared/toolkit-components'
import { createContext, useContext } from 'react'
import type { AppSettings } from '../desktop/types'

export const ComponentSettingsContext = createContext<
  (ToolkitComponentSettings & Pick<AppSettings, 'dictationProvider'>) | undefined
>(undefined)

export function useToolkitComponentEnabled(id: ToolkitComponentId) {
  return isToolkitComponentEnabled(useContext(ComponentSettingsContext), id)
}
