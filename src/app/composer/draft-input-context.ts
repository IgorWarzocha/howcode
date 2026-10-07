import {
  type ComponentType,
  createContext,
  type Dispatch,
  type KeyboardEventHandler,
  type ReactNode,
  type SetStateAction,
} from 'react'
import type { AppSettings, DesktopActionInvoker } from '../desktop/types'
import type { SettingsOpenTarget } from '../settings/settings/settingsTypes'
import type { View } from '../types'

export type DraftInputContributionProps = {
  appSettings: AppSettings
  projectId: string
  conversationId: string | null
  draftThreadId: string
  activeView: View
  inputLocked: boolean
  setDraftValue: Dispatch<SetStateAction<string>>
  setErrorMessage: Dispatch<SetStateAction<string | null>>
  onAction: DesktopActionInvoker
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  children: (input: {
    leadingAdornment: ReactNode
    onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
  }) => ReactNode
}

export const DraftInputContributionContext =
  createContext<ComponentType<DraftInputContributionProps> | null>(null)
