import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(__dirname, '..', '..')
const macDragZonesPattern =
  /:root\[data-desktop-platform="darwin"\] \.mac-window-drag-zones\s*\{[^}]*display:\s*block;/s
const dragRegionPattern = /\.mac-window-drag-zone\s*\{[^}]*-webkit-app-region:\s*drag;/s

function readProjectFile(filePath: string) {
  return readFileSync(path.join(projectRoot, filePath), 'utf8')
}

describe('macOS window controls', () => {
  it('keeps native select-all in the Electron Edit menu', () => {
    const applicationMenuSource = readProjectFile('src/electron/main/app/application-menu.ts')

    expect(applicationMenuSource).toContain("{ role: 'selectAll' }")
  })

  it('keeps invisible macOS drag zones mounted in the app shell', () => {
    const appShellLayout = readProjectFile('src/app/app-shell/app-shell-layout-view.tsx')

    expect(appShellLayout).toContain('function MacWindowDragZones()')
    expect(appShellLayout).toContain('<MacWindowDragZones />')
  })

  it('keeps macOS drag zones platform-scoped and draggable', () => {
    const baseStyles = readProjectFile('src/styles/base.css')

    expect(baseStyles).toMatch(macDragZonesPattern)
    expect(baseStyles).toMatch(dragRegionPattern)
    expect(baseStyles).not.toContain('mac-window-drag-zone--right')
  })
})
