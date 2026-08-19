import type { RefObject } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'

export function useSettingsHelpLayout(input: {
  settingsScrollRef: RefObject<HTMLDivElement | null>
  visibleSettingIds: string
}) {
  const [showHelp, setShowHelp] = useState(false)
  const [helpColumnAvailable, setHelpColumnAvailable] = useState(false)
  const [settingRowHeights, setSettingRowHeights] = useState<Record<string, number>>({})

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const updateAvailability = () => {
      setHelpColumnAvailable(query.matches)
      if (!query.matches) setShowHelp(false)
    }
    updateAvailability()
    query.addEventListener('change', updateAvailability)
    return () => query.removeEventListener('change', updateAvailability)
  }, [])

  useLayoutEffect(() => {
    void input.visibleSettingIds
    if (!(showHelp && input.settingsScrollRef.current) || typeof ResizeObserver === 'undefined') {
      setSettingRowHeights((current) => (Object.keys(current).length === 0 ? current : {}))
      return
    }

    let frameId: number | null = null
    const rows = [
      ...input.settingsScrollRef.current.querySelectorAll<HTMLElement>('[data-setting-id]'),
    ]
    const updateHeights = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        frameId = null
        const nextHeights = Object.fromEntries(
          rows.map((row) => [
            row.getAttribute('data-setting-id') ?? '',
            Math.ceil(row.offsetHeight),
          ]),
        )
        setSettingRowHeights((current) => {
          const nextKeys = Object.keys(nextHeights)
          const unchanged =
            Object.keys(current).length === nextKeys.length &&
            nextKeys.every((key) => current[key] === nextHeights[key])
          return unchanged ? current : nextHeights
        })
      })
    }

    const observer = new ResizeObserver(updateHeights)
    for (const row of rows) observer.observe(row)
    updateHeights()
    return () => {
      observer.disconnect()
      if (frameId !== null) window.cancelAnimationFrame(frameId)
    }
  }, [input.settingsScrollRef, input.visibleSettingIds, showHelp])

  return {
    helpColumnAvailable,
    settingRowHeights,
    setShowHelp,
    showHelp,
  }
}
