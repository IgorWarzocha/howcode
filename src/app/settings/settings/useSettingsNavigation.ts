import type { RefObject } from 'react'
import { useEffect, useState } from 'react'
import type { SettingsCategoryId, SettingsOpenTarget } from './settingsTypes'

export function useSettingsNavigation(input: {
  openTarget: SettingsOpenTarget | null
  settingsScrollRef: RefObject<HTMLDivElement | null>
}) {
  const targetKey = `${input.openTarget?.category ?? ''}\0${input.openTarget?.settingId ?? ''}`
  const [filterEdit, setFilterEdit] = useState<{ source: string; value: string } | null>(null)
  const [categoryEdit, setCategoryEdit] = useState<{
    source: string
    value: SettingsCategoryId | null
  } | null>(null)
  const filter = filterEdit?.source === targetKey ? filterEdit.value : ''
  const activeCategory =
    categoryEdit?.source === targetKey ? categoryEdit.value : (input.openTarget?.category ?? null)
  const [openSelectId, setOpenSelectId] = useState<string | null>(null)
  const [highlightedSettingId, setHighlightedSettingId] = useState<string | null>(null)
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<SettingsCategoryId | null>(
    null,
  )

  useEffect(() => {
    if (!input.openTarget) return
    setHighlightedSettingId(input.openTarget.settingId ?? null)
    setHighlightedCategoryId(input.openTarget.category ?? null)
  }, [input.openTarget])

  useEffect(() => {
    if (!openSelectId) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && !target.closest('[data-inline-select-root]')) {
        setOpenSelectId(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpenSelectId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [openSelectId])

  useEffect(() => {
    if (!highlightedSettingId) return
    const frameId = window.requestAnimationFrame(() => {
      const target = input.settingsScrollRef.current?.querySelector<HTMLElement>(
        `[data-setting-id="${CSS.escape(highlightedSettingId)}"]`,
      )
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    const timeoutId = window.setTimeout(() => setHighlightedSettingId(null), 2200)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [highlightedSettingId, input.settingsScrollRef])

  useEffect(() => {
    if (!highlightedCategoryId) return
    const timeoutId = window.setTimeout(() => setHighlightedCategoryId(null), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [highlightedCategoryId])

  return {
    activeCategory,
    filter,
    highlightedCategoryId,
    normalizedFilter: filter.trim().toLowerCase(),
    openSelectId,
    setActiveCategory: (value: SettingsCategoryId | null) =>
      setCategoryEdit({ source: targetKey, value }),
    setFilter: (value: string) => setFilterEdit({ source: targetKey, value }),
    setOpenSelectId,
  }
}
