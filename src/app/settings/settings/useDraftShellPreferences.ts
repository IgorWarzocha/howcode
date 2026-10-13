import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker, ShellPreferences } from '../../desktop/types'
import { appendShellPreferencesWrite } from './shellPreferencesWriteQueue'

const resolvedPromise = Promise.resolve()

export function useDraftShellPreferences(input: {
  onAction: DesktopActionInvoker
  shellPreferences: ShellPreferences
}) {
  const [draftShellPreferences, setDraftShellPreferences] = useState(input.shellPreferences)
  const shellPreferencesRef = useRef(input.shellPreferences)
  const draftShellPreferencesRef = useRef(draftShellPreferences)
  const dirtyKeysRef = useRef(new Set<keyof ShellPreferences>())
  const writeQueueRef = useRef<Promise<unknown>>(resolvedPromise)
  const pendingThemeRef = useRef<string | null>(null)

  const revertFailedThemeUpdate = useCallback((failedTheme: string) => {
    if (pendingThemeRef.current !== failedTheme) return
    pendingThemeRef.current = null
    const current = draftShellPreferencesRef.current
    if (current.theme !== failedTheme) return
    const next = { ...current, theme: shellPreferencesRef.current.theme }
    draftShellPreferencesRef.current = next
    setDraftShellPreferences(next)
  }, [])

  useEffect(() => {
    draftShellPreferencesRef.current = draftShellPreferences
  }, [draftShellPreferences])

  useEffect(() => {
    shellPreferencesRef.current = input.shellPreferences
    if (pendingThemeRef.current === input.shellPreferences.theme) pendingThemeRef.current = null
    if (dirtyKeysRef.current.size === 0) {
      const next = pendingThemeRef.current
        ? { ...input.shellPreferences, theme: pendingThemeRef.current }
        : input.shellPreferences
      draftShellPreferencesRef.current = next
      setDraftShellPreferences(next)
    }
  }, [input.shellPreferences])

  const setDraftShellPreference = useCallback(
    <Key extends keyof ShellPreferences>(key: Key, value: ShellPreferences[Key]) => {
      if (key === 'theme') {
        const theme = value as string
        dirtyKeysRef.current.delete(key)
        pendingThemeRef.current = theme
        const next = { ...draftShellPreferencesRef.current, theme }
        draftShellPreferencesRef.current = next
        setDraftShellPreferences(next)
        writeQueueRef.current = appendShellPreferencesWrite(writeQueueRef.current, async () => {
          try {
            const result = await input.onAction('shell-preferences.update', {
              shellPreferencesKey: key,
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
      const next = { ...draftShellPreferencesRef.current, [key]: value }
      draftShellPreferencesRef.current = next
      setDraftShellPreferences(next)
    },
    [input.onAction, revertFailedThemeUpdate],
  )

  const flushShellPreferences = useCallback(async () => {
    const dirtyKeys = [...dirtyKeysRef.current]
    dirtyKeysRef.current.clear()
    const snapshot = draftShellPreferencesRef.current
    if (dirtyKeys.length > 0) {
      writeQueueRef.current = dirtyKeys.reduce<Promise<unknown>>(
        (queue, key) =>
          appendShellPreferencesWrite(queue, async () => {
            await input.onAction('shell-preferences.update', {
              shellPreferencesKey: key,
              value: snapshot[key],
            })
          }),
        writeQueueRef.current,
      )
    }
    await writeQueueRef.current
  }, [input.onAction])

  useEffect(() => () => void flushShellPreferences(), [flushShellPreferences])

  return { draftShellPreferences, flushShellPreferences, setDraftShellPreference }
}
