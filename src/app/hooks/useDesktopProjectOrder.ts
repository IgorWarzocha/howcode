import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ShellState } from '../desktop/types'
import { desktopQueryKeys } from '../query/desktop-query'

export function useDesktopProjectOrder() {
  const queryClient = useQueryClient()
  return useCallback(
    (projectIds: string[]) => {
      queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) => {
        if (!currentState) return currentState ?? null

        const orderIndexById = new Map(projectIds.map((projectId, index) => [projectId, index]))
        return {
          ...currentState,
          projects: [...currentState.projects].sort((left, right) => {
            const leftIndex = orderIndexById.get(left.id)
            const rightIndex = orderIndexById.get(right.id)
            if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex
            if (leftIndex !== undefined) return -1
            if (rightIndex !== undefined) return 1
            return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
          }),
        }
      })
    },
    [queryClient],
  )
}
