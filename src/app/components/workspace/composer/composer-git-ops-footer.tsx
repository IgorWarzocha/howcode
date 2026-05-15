import { ArrowLeft, Columns2, Rows3, Settings } from 'lucide-react'
import {
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type {
  GitOpsMode,
  ProjectDiffBaseline,
  ProjectDiffRenderMode,
  ProjectGitState,
} from '../../../desktop/types'
import {
  compactIconButtonClass,
  diffPanelIconButtonClass,
  diffPanelTurnChipSelectedClass,
  popoverPanelClass,
} from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import {
  workspaceFooterRowClass,
  workspaceFooterTrailingGroupClass,
} from '../footer/workspace-footer-primitives'
import { ComposerDiffBaselineSelector } from './composer-diff-baseline-selector'
import { PlainToggle } from './plain-toggle'

type ComposerGitOpsFooterProps = {
  composerPanelRef: RefObject<HTMLDivElement | null>
  diffBaseline: ProjectDiffBaseline
  diffRenderMode: ProjectDiffRenderMode
  hasOrigin: boolean
  includeUnstaged: boolean
  isGitRepo: boolean
  onSaveOrigin: () => void
  onBack: () => void
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void
  onSetDiffRenderMode: (mode: ProjectDiffRenderMode) => void
  onSetRepoUrl: (repoUrl: string) => void
  onToggleIncludeUnstaged: () => void
  onTogglePreview: () => void
  onTogglePush: () => void
  onSaveProjectGitOpsMode: (mode: GitOpsMode | null) => void
  previewEnabled: boolean
  projectGitState: ProjectGitState | null
  pushEnabled: boolean
  repoUrl: string
}

export function ComposerGitOpsFooter({
  composerPanelRef,
  diffBaseline,
  diffRenderMode,
  hasOrigin,
  includeUnstaged,
  isGitRepo,
  onSaveOrigin,
  onBack,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  onSetRepoUrl,
  onToggleIncludeUnstaged,
  onTogglePreview,
  onTogglePush,
  onSaveProjectGitOpsMode,
  previewEnabled,
  projectGitState,
  pushEnabled,
  repoUrl,
}: ComposerGitOpsFooterProps) {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [optionsPopoverLeft, setOptionsPopoverLeft] = useState(0)
  const optionsRef = useRef<HTMLDivElement>(null)
  const repoInputRef = useRef<HTMLInputElement>(null)
  const originSaveRequestedRef = useRef(false)

  const openOriginEditor = () => {
    setOptionsOpen(true)
    window.requestAnimationFrame(() => repoInputRef.current?.focus())
  }

  const saveOriginOnce = useCallback(() => {
    if (hasOrigin || repoUrl.trim().length === 0 || originSaveRequestedRef.current) {
      return
    }

    originSaveRequestedRef.current = true
    void Promise.resolve(onSaveOrigin()).finally(() => {
      originSaveRequestedRef.current = false
    })
  }, [hasOrigin, onSaveOrigin, repoUrl])
  const saveOriginFromOutsidePointerDown = useEffectEvent(() => saveOriginOnce())

  useEffect(() => {
    if (optionsOpen && !hasOrigin) {
      repoInputRef.current?.focus()
    }
  }, [hasOrigin, optionsOpen])

  useLayoutEffect(() => {
    if (!optionsOpen) return

    const updatePopoverLeft = () => {
      const composerRect = composerPanelRef.current?.getBoundingClientRect()
      const optionsRect = optionsRef.current?.getBoundingClientRect()
      if (!(composerRect && optionsRect)) return
      setOptionsPopoverLeft(composerRect.left - optionsRect.left)
    }

    updatePopoverLeft()
    window.addEventListener('resize', updatePopoverLeft)
    window.addEventListener('scroll', updatePopoverLeft, true)
    return () => {
      window.removeEventListener('resize', updatePopoverLeft)
      window.removeEventListener('scroll', updatePopoverLeft, true)
    }
  }, [composerPanelRef, optionsOpen])

  useEffect(() => {
    if (!optionsOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && optionsRef.current?.contains(target)) {
        return
      }

      saveOriginFromOutsidePointerDown()

      window.setTimeout(() => setOptionsOpen(false), 0)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [optionsOpen])

  useEffect(() => {
    if (!optionsOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setOptionsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [optionsOpen])

  return (
    <div className={workspaceFooterRowClass}>
      {isGitRepo ? (
        <div className="inline-flex items-center gap-1.5">
          <div ref={optionsRef} className="relative inline-flex">
            <button
              type="button"
              className={cn(compactIconButtonClass, 'h-7 w-7')}
              onClick={() => setOptionsOpen((current) => !current)}
              aria-label="GitOps settings"
              aria-haspopup="menu"
              aria-expanded={optionsOpen}
              data-tooltip="GitOps settings"
            >
              <Settings size={14} />
            </button>

            {optionsOpen ? (
              <div
                className={cn(
                  popoverPanelClass,
                  'absolute bottom-[calc(100%+8px)] z-20 grid min-w-56 gap-2 rounded-xl border p-3',
                )}
                style={{ left: `${optionsPopoverLeft}px` }}
                role="menu"
                aria-label="GitOps settings"
              >
                {hasOrigin ? null : (
                  <label className="grid gap-1">
                    <span className="px-1 text-[11px] text-[color:var(--muted)]">
                      GitHub origin URL
                    </span>
                    <input
                      ref={repoInputRef}
                      value={repoUrl}
                      onChange={(event) => onSetRepoUrl(event.target.value)}
                      onBlur={() => {
                        saveOriginOnce()
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          saveOriginOnce()
                        }
                      }}
                      className="min-h-7 rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] px-2.5 text-[12px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
                      placeholder="https://github.com/owner/repo"
                      aria-label="GitHub origin URL"
                    />
                  </label>
                )}
                <PlainToggle
                  label="Include unstaged"
                  checked={includeUnstaged}
                  onClick={onToggleIncludeUnstaged}
                  toggleSide="left"
                />
                <PlainToggle
                  label="Draft message"
                  checked={previewEnabled}
                  onClick={onTogglePreview}
                  toggleSide="left"
                />
                <PlainToggle
                  label="Commit & push"
                  checked={pushEnabled}
                  disabled={!hasOrigin}
                  onClick={() => {
                    const nextMode = pushEnabled ? 'commit' : 'commit-push'
                    onTogglePush()
                    void onSaveProjectGitOpsMode(nextMode)
                  }}
                  toggleSide="left"
                />
                <PlainToggle
                  label="Use app default"
                  checked={projectGitState?.gitOpsModeOverride === null}
                  onClick={() => {
                    void onSaveProjectGitOpsMode(null)
                  }}
                  toggleSide="left"
                />
              </div>
            ) : null}
          </div>
          {hasOrigin ? null : (
            <button
              type="button"
              className="composer-origin-control composer-footer-text inline-flex h-7 items-center rounded-lg border border-[color:var(--border)] px-2.5 py-0 text-[color:var(--muted)] transition-colors duration-150 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
              onClick={openOriginEditor}
              aria-label="Add GitHub origin"
              data-tooltip="Add GitHub origin"
            >
              Add origin
            </button>
          )}
          <button
            type="button"
            className={cn(
              diffPanelIconButtonClass,
              diffRenderMode === 'stacked'
                ? diffPanelTurnChipSelectedClass
                : 'border-[color:var(--border)] bg-transparent',
            )}
            onClick={() => onSetDiffRenderMode('stacked')}
            aria-label="Unified diff view"
            data-tooltip="Unified diff view"
          >
            <Rows3 size={14} />
          </button>
          <button
            type="button"
            className={cn(
              diffPanelIconButtonClass,
              diffRenderMode === 'split'
                ? diffPanelTurnChipSelectedClass
                : 'border-[color:var(--border)] bg-transparent',
            )}
            onClick={() => onSetDiffRenderMode('split')}
            aria-label="Split diff view"
            data-tooltip="Split diff view"
          >
            <Columns2 size={14} />
          </button>
        </div>
      ) : null}

      <div className={workspaceFooterTrailingGroupClass}>
        {isGitRepo ? (
          <ComposerDiffBaselineSelector
            composerPanelRef={composerPanelRef}
            projectId={projectGitState?.projectId ?? ''}
            projectGitState={projectGitState}
            selectedBaseline={diffBaseline}
            onSelectBaseline={onSetDiffBaseline}
          />
        ) : null}
        <button
          type="button"
          className={cn(compactIconButtonClass, 'h-7 w-7')}
          onClick={onBack}
          aria-label="Back"
          data-tooltip="Back"
        >
          <ArrowLeft size={14} />
        </button>
      </div>
    </div>
  )
}
