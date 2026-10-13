import { composerTextActionButtonClass } from '@howaboua/howcode-sdk/ui/classes'
import { Input } from '@howaboua/howcode-sdk/ui/controls'
import { useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../desktop/types'

export function SettingsPiImport({
  onAction,
  beforeImport,
  defaultDirectory,
}: {
  onAction: DesktopActionInvoker
  beforeImport: () => Promise<void>
  defaultDirectory: string | null | undefined
}) {
  const [directory, setDirectory] = useState('')
  const [result, setResult] = useState<
    { status: 'idle' | 'busy' } | { status: 'success' | 'error'; message: string }
  >({ status: 'idle' })
  const pending = useRef(false)
  const importPreferences = async () => {
    if (pending.current) return
    pending.current = true
    setResult({ status: 'busy' })
    try {
      await beforeImport()
      const directoryPath = directory.trim()
      const response = await onAction(
        'shell-preferences.import-pi',
        directoryPath ? { directoryPath } : {},
      )
      const report = response?.result?.preferenceImport
      if (!(response?.ok && report))
        throw new Error(response?.result?.error ?? 'Could not import preferences.')
      setResult({
        status: 'success',
        message: `Imported ${report.importedKeys.length} preferences from ${report.sourcePath}.`,
      })
    } catch (error) {
      setResult({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      pending.current = false
    }
  }
  return (
    <div className="grid max-w-full gap-2">
      <Input
        aria-label="Pi configuration directory to import"
        value={directory}
        placeholder={defaultDirectory ?? '~/.pi/agent'}
        onChange={(event) => setDirectory(event.target.value)}
        disabled={result.status === 'busy'}
      />
      <button
        type="button"
        className={composerTextActionButtonClass}
        onClick={() => void importPreferences()}
        disabled={result.status === 'busy'}
      >
        {result.status === 'busy' ? 'Importing…' : 'Import from Pi'}
      </button>
      {'message' in result ? (
        <p
          role={result.status === 'error' ? 'alert' : 'status'}
          className="max-w-sm break-words text-sm text-[color:var(--muted)]"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  )
}
