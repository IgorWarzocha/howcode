import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(__dirname, '..', '..')
const macSidebarDragRegionPattern =
  /:root\[data-desktop-platform="darwin"\] \.sidebar-shell::before\s*\{[^}]*-webkit-app-region:\s*drag;/s
const macWorkspaceDragRegionPattern =
  /:root\[data-desktop-platform="darwin"\] \.window-drag-region\s*\{[^}]*-webkit-app-region:\s*drag;/s

function readProjectFile(filePath: string) {
  return readFileSync(path.join(projectRoot, filePath), 'utf8')
}

describe('macOS window controls', () => {
  it('keeps the native select-all command in the Electron Edit menu', () => {
    const applicationMenuSource = readProjectFile('src/electron/main/app/application-menu.ts')

    expect(applicationMenuSource).toContain("{ role: 'selectAll' }")
  })

  it('keeps the empty macOS sidebar title-bar area draggable', () => {
    const sidebarStyles = readProjectFile('src/styles/sidebar/base.css')

    expect(sidebarStyles).toMatch(macSidebarDragRegionPattern)
  })

  it('keeps a macOS drag area available when the sidebar is hidden', () => {
    const appShellLayout = readProjectFile('src/app/app-shell/app-shell-layout-view.tsx')
    const baseStyles = readProjectFile('src/styles/base.css')

    expect(appShellLayout).toContain(
      'sidebarCollapsed || sidebarCompactMode ? <div className="window-drag-region" /> : null',
    )
    expect(baseStyles).toMatch(macWorkspaceDragRegionPattern)
  })
})
