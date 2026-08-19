import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker, PiSettings } from '../../desktop/types'
import { appendPiSettingsWrite } from './piSettingsWriteQueue'

const resolvedPromise = Promise.resolve()

export function useDraftPiSettings(input: {
  onAction: DesktopActionInvoker
  piSettings: PiSettings
}) {
  const [draftPiSettings, setDraftPiSettings] = useState(input.piSettings)
  const piSettingsRef = useRef(input.piSettings)
  const draftPiSettingsRef = useRef(draftPiSettings)
  const dirtyKeysRef = useRef(new Set<keyof PiSettings>())
  const writeQueueRef = useRef<Promise<unknown>>(resolvedPromise)
  const pendingThemeRef = useRef<string | null>(null)

  const revertFailedThemeUpdate = useCallback((failedTheme: string) => {
    if (pendingThemeRef.current !== failedTheme) return
    pendingThemeRef.current = null
    const current = draftPiSettingsRef.current
    if (current.theme !== failedTheme) return
    const next = { ...current, theme: piSettingsRef.current.theme }
    draftPiSettingsRef.current = next
    setDraftPiSettings(next)
  }, [])

  useEffect(() => {
    draftPiSettingsRef.current = draftPiSettings
  }, [draftPiSettings])

  useEffect(() => {
    piSettingsRef.current = input.piSettings
    if (pendingThemeRef.current === input.piSettings.theme) pendingThemeRef.current = null
    if (dirtyKeysRef.current.size === 0) {
      const next = pendingThemeRef.current
        ? { ...input.piSettings, theme: pendingThemeRef.current }
        : input.piSettings
      draftPiSettingsRef.current = next
      setDraftPiSettings(next)
    }
  }, [input.piSettings])

  const setDraftPiSetting = useCallback(
    <Key extends keyof PiSettings>(key: Key, value: PiSettings[Key]) => {
      if (key === 'theme') {
        const theme = value as string
        dirtyKeysRef.current.delete(key)
        pendingThemeRef.current = theme
        const next = { ...draftPiSettingsRef.current, theme }
        draftPiSettingsRef.current = next
        setDraftPiSettings(next)
        writeQueueRef.current = appendPiSettingsWrite(writeQueueRef.current, async () => {
          try {
            const result = await input.onAction('pi-settings.update', {
              piSettingsKey: key,
              value: theme,
            })
            if (!result || result.ok === false || typeof result.result?.error === 'string') {
              revertFailedThemeUpdate(theme)
            }
          } catch {
            revertFailedThemeUpdate(theme)
          }
        })
        return
      }

      dirtyKeysRef.current.add(key)
      const next = { ...draftPiSettingsRef.current, [key]: value }
      draftPiSettingsRef.current = next
      setDraftPiSettings(next)
    },
    [input.onAction, revertFailedThemeUpdate],
  )

  const flushPiSettings = useCallback(async () => {
    const dirtyKeys = [...dirtyKeysRef.current]
    dirtyKeysRef.current.clear()
    const snapshot = draftPiSettingsRef.current
    if (dirtyKeys.length > 0) {
      writeQueueRef.current = dirtyKeys.reduce<Promise<unknown>>(
        (queue, key) =>
          appendPiSettingsWrite(queue, async () => {
            await input.onAction('pi-settings.update', {
              piSettingsKey: key,
              value: snapshot[key],
            })
          }),
        writeQueueRef.current,
      )
    }
    await writeQueueRef.current
  }, [input.onAction])

  useEffect(() => () => void flushPiSettings(), [flushPiSettings])

  return { draftPiSettings, flushPiSettings, setDraftPiSetting }
}
