import { useEffect } from 'react'
import { type GuiThemeValues, getThemeValues, managedVars } from '../../../shared/gui-theme'
import type { PiThemeState } from '../desktop/types'

const storageKey = 'howcode:pi-gui-theme:v1'
export const piGuiThemeUpdatedEvent = 'howcode:pi-gui-theme-updated'

function applyValues(values: GuiThemeValues) {
  const root = document.documentElement
  root.style.colorScheme = values.colorScheme
  for (const property of managedVars) {
    root.style.setProperty(property, values[property])
  }
  window.dispatchEvent(new CustomEvent(piGuiThemeUpdatedEvent))
}

export function applyStoredPiGuiTheme() {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return
    const values = JSON.parse(stored) as Partial<GuiThemeValues>
    if (values.colorScheme !== 'dark' && values.colorScheme !== 'light') return
    if (!managedVars.every((property) => typeof values[property] === 'string')) return
    applyValues(values as GuiThemeValues)
  } catch {
    // Ignore stale or invalid cached theme state.
  }
}

export function usePiGuiTheme(piTheme: PiThemeState | null | undefined) {
  useEffect(() => {
    if (!piTheme) return

    const values = getThemeValues(piTheme)
    applyValues(values)
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(values))
    } catch {
      // Best effort only; the live theme is still applied.
    }
  }, [piTheme])
}
