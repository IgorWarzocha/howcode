import type { SidebarMaintenance } from './dependencies.ts'

/** Folder lifecycle composes optional Sidebar discovery without owning Git metadata policy. */
export function createDirectoryImport(getSidebar: () => SidebarMaintenance | undefined) {
  return {
    scanKnownDirectories: (directoryIds: string[]) => {
      const sidebar = getSidebar()
      if (!sidebar) throw new Error('Enable Sidebar to scan repository metadata.')
      return sidebar.scanDirectories({ directoryIds })
    },
    importDirectories: (directoryIds: string[]) => {
      const sidebar = getSidebar()
      if (!sidebar) throw new Error('Enable Sidebar to import repository metadata.')
      return sidebar.importDirectories({ directoryIds })
    },
  }
}
