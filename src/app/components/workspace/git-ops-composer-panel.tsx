import { Check, Clipboard } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type {
  AppSettings,
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectDiffRenderMode,
  ProjectGitState,
} from '../../desktop/types'
import { ComposerGitOpsSurface } from './composer/composer-git-ops-surface'
import type { SavedDiffComment } from './diff/diffCommentStore'

type GitOpsComposerPanelProps = {
  dictationModelId: string | null
  dictationMaxDurationSeconds: number
  projectGitState: ProjectGitState | null
  projectId: string
  sessionPath: string | null
  showDictationButton: boolean
  appSettings: AppSettings
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  diffComments: SavedDiffComment[]
  diffCommentCount: number
  diffCommentsSending: boolean
  diffCommentError: string | null
  diffLoadError: string | null
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (mode: ProjectDiffRenderMode) => void
  onSendDiffComments: (message?: string | null) => void
  onSelectDiffComment: (filePath: string, commentId: string) => void
  onAction: DesktopActionInvoker
  onLayoutChange: () => void
  onBack: () => void
  onOpenSettingsView: () => void
}

function GitOpsErrorDetails({ detail, onDismiss }: { detail: string; onDismiss: () => void }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const helperText =
    copyState === 'failed' ? '- copy failed, press Escape to dismiss' : '- click copy to dismiss'

  useEffect(() => {
    if (copyState === 'idle') return

    const timeout = window.setTimeout(() => setCopyState('idle'), 1400)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      onDismiss()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onDismiss])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(detail)
      setCopyState('copied')
      onDismiss()
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-[calc(100%+0.75rem)] z-20"
      role="alert"
      aria-live="polite"
    >
      <div className="group relative rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--panel)] px-3 py-2 pr-12 text-[13px] shadow-[var(--shadow)]">
        <div className="grid gap-1">
          <div className="flex items-center gap-2 text-[color:var(--danger)]">
            <span className="h-2 w-2 rounded-full bg-[color:var(--danger)]" />
            <span>GitOps action failed</span>
            <span className="text-[color:var(--muted)]">{helperText}</span>
          </div>
          <div className="whitespace-pre-wrap font-mono text-[12px] text-[color:var(--muted)]">
            {detail}
          </div>
        </div>
        <button
          type="button"
          className="absolute top-1.5 right-1.5 grid h-8 min-w-8 place-items-center rounded-[10px] border border-[color:var(--border)] bg-[color:var(--panel)] px-2 text-[11px] font-medium text-[color:var(--muted)] opacity-75 shadow-[var(--shadow)] backdrop-blur-sm transition-[opacity,scale,background-color,color] duration-150 ease-out hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-border)] active:scale-[0.96] group-hover:opacity-100"
          onClick={() => void handleCopy()}
          aria-label={copyState === 'copied' ? 'Copied git error' : 'Copy git error'}
          title={
            copyState === 'failed' ? 'Copy failed' : copyState === 'copied' ? 'Copied' : 'Copy'
          }
        >
          {copyState === 'copied' ? <Check size={14} /> : <Clipboard size={14} />}
        </button>
      </div>
    </div>
  )
}

export function GitOpsComposerPanel({
  dictationModelId,
  dictationMaxDurationSeconds,
  projectGitState,
  projectId,
  sessionPath,
  showDictationButton,
  appSettings,
  diffBaseline,
  diffRenderMode,
  diffComments,
  diffCommentCount,
  diffCommentsSending,
  diffCommentError,
  diffLoadError,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  onSendDiffComments,
  onSelectDiffComment,
  onAction,
  onLayoutChange,
  onBack,
  onOpenSettingsView,
}: GitOpsComposerPanelProps) {
  const composerPanelRef = useRef<HTMLDivElement>(null)
  const [gitActionErrorMessage, setGitActionErrorMessage] = useState<string | null>(null)
  const [gitActionErrorDismissed, setGitActionErrorDismissed] = useState(false)
  const visibleGitActionErrorMessage =
    gitActionErrorMessage && !gitActionErrorDismissed ? gitActionErrorMessage : null

  return (
    <div className="relative grid gap-0 overflow-visible">
      {visibleGitActionErrorMessage ? (
        <GitOpsErrorDetails
          detail={visibleGitActionErrorMessage}
          onDismiss={() => setGitActionErrorDismissed(true)}
        />
      ) : null}
      <section
        ref={composerPanelRef}
        className="grid gap-0 overflow-visible rounded-[20px] border border-[color:var(--accent-border)] bg-[color:var(--panel)] shadow-none"
        aria-label="Git ops composer panel"
      >
        <ComposerGitOpsSurface
          dictationModelId={dictationModelId}
          dictationMaxDurationSeconds={dictationMaxDurationSeconds}
          composerPanelRef={composerPanelRef}
          onOpenSettingsView={onOpenSettingsView}
          projectGitState={projectGitState}
          projectId={projectId}
          sessionPath={sessionPath}
          showDictationButton={showDictationButton}
          appSettings={appSettings}
          diffBaseline={diffBaseline}
          diffRenderMode={diffRenderMode}
          diffComments={diffComments}
          diffCommentCount={diffCommentCount}
          diffCommentsSending={diffCommentsSending}
          diffCommentError={diffCommentError}
          diffLoadError={diffLoadError}
          onSetDiffBaseline={onSetDiffBaseline}
          onSetDiffRenderMode={onSetDiffRenderMode}
          onSendDiffComments={onSendDiffComments}
          onSelectDiffComment={onSelectDiffComment}
          onAction={onAction}
          onLayoutChange={onLayoutChange}
          onBack={onBack}
          onActionErrorMessageChange={(message) => {
            setGitActionErrorMessage(message)
            setGitActionErrorDismissed(false)
          }}
        />
      </section>
    </div>
  )
}
