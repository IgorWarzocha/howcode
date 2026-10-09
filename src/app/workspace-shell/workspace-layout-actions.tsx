import { createContext, type ReactNode, useContext, useState } from 'react'
import type { WorkspaceLayoutWriteLane } from './workspace-layout-sync'

type LayoutActions = { conversationId: string; saveDefault: () => void }

const ActionsContext = createContext<LayoutActions | null>(null)
const WriteLaneContext = createContext<WorkspaceLayoutWriteLane | null>(null)
const RegisterContext = createContext<(actions: LayoutActions | null) => void>(() => {
  throw new Error('Workspace layout actions provider is missing.')
})

export function WorkspaceLayoutActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<LayoutActions | null>(null)
  const [lane] = useState<WorkspaceLayoutWriteLane>(() => ({ current: Promise.resolve() }))
  return (
    <WriteLaneContext value={lane}>
      <RegisterContext value={setActions}>
        <ActionsContext value={actions}>{children}</ActionsContext>
      </RegisterContext>
    </WriteLaneContext>
  )
}

export const useWorkspaceLayoutActions = () => useContext(ActionsContext)
export const useRegisterWorkspaceLayoutActions = () => useContext(RegisterContext)
export function useWorkspaceLayoutWriteLane() {
  const lane = useContext(WriteLaneContext)
  if (!lane) throw new Error('Workspace layout actions provider is missing.')
  return lane
}
