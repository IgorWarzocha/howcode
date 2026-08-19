import { Settings } from 'lucide-react'
import {
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { PopoverPanel } from '../../common/popover'
import { PlainToggle } from '../../composer/plain-toggle'
import {
  appToneMutedClass,
  appTypeMetaClass,
  compactIconButtonClass,
  composerPopoverBottomRowLayerClass,
  composerPopoverInputClass,
  popoverPanelClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import { workspaceFooterTextClass } from '../../workspace-shell/footer/workspace-footer-primitives'
import type { ComposerGitOpsState } from './useComposerGitOpsState'

type GitOpsSettingsProps = {
  composerPanelRef: RefObject<HTMLDivElement | null>
  hasOrigin: boolean
  includeUntracked: boolean
  onToggleIncludeUntracked: () => void
  options: ComposerGitOpsState['options']
  usesAppDefault: boolean
}

export function ComposerGitOpsSettings({
  composerPanelRef,
  hasOrigin,
  includeUntracked,
  onToggleIncludeUntracked,
  options,
  usesAppDefault,
}: GitOpsSettingsProps) {
  const [open, setOpen] = useState(false)
  const [popoverLeft, setPopoverLeft] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const repoInputRef = useRef<HTMLInputElement>(null)
  const originSaveRequestedRef = useRef(false)

  const openOriginEditor = () => {
    setOpen(true)
    window.requestAnimationFrame(() => repoInputRef.current?.focus())
  }

  const saveOriginOnce = useCallback(() => {
    if (hasOrigin || options.repoUrl.trim().length === 0 || originSaveRequestedRef.current) {
      return
    }

    originSaveRequestedRef.current = true
    void Promise.resolve(options.saveOrigin()).finally(() => {
      originSaveRequestedRef.current = false
    })
  }, [hasOrigin, options.repoUrl, options.saveOrigin])
  const saveOriginFromOutsidePointerDown = useEffectEvent(() => saveOriginOnce())

  useEffect(() => {
    if (open && !hasOrigin) repoInputRef.current?.focus()
  }, [hasOrigin, open])

  useLayoutEffect(() => {
    if (!open) return

    const updatePopoverLeft = () => {
      const composerRect = composerPanelRef.current?.getBoundingClientRect()
      const optionsRect = rootRef.current?.getBoundingClientRect()
      if (composerRect && optionsRect) setPopoverLeft(composerRect.left - optionsRect.left)
    }

    updatePopoverLeft()
    window.addEventListener('resize', updatePopoverLeft)
    window.addEventListener('scroll', updatePopoverLeft, true)
    return () => {
      window.removeEventListener('resize', updatePopoverLeft)
      window.removeEventListener('scroll', updatePopoverLeft, true)
    }
  }, [composerPanelRef, open])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && rootRef.current?.contains(target)) return
      saveOriginFromOutsidePointerDown()
      window.setTimeout(() => setOpen(false), 0)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  return (
    <>
      <div ref={rootRef} className="relative inline-flex">
        <button
          type="button"
          className={cn(compactIconButtonClass, 'h-7 w-7')}
          onClick={() => setOpen((current) => !current)}
          aria-label="GitOps settings"
          aria-haspopup="menu"
          aria-expanded={open}
          data-tooltip="GitOps settings"
        >
          <Settings size={14} />
        </button>
        {open ? (
          <PopoverPanel
            className={cn(
              popoverPanelClass,
              'absolute bottom-[calc(100%+8px)] grid min-w-56 gap-1.5 rounded-xl border-0 p-1.5',
              composerPopoverBottomRowLayerClass,
            )}
            style={{ left: `${popoverLeft}px` }}
            role="menu"
            aria-label="GitOps settings"
          >
            {hasOrigin ? null : (
              <label className="grid gap-1 px-1 pb-1">
                <span className={cn(appTypeMetaClass, appToneMutedClass)}>GitHub origin URL</span>
                <input
                  ref={repoInputRef}
                  value={options.repoUrl}
                  onChange={(event) => options.setRepoUrl(event.target.value)}
                  onBlur={saveOriginOnce}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      saveOriginOnce()
                    }
                  }}
                  className={composerPopoverInputClass}
                  placeholder="https://github.com/owner/repo"
                  aria-label="GitHub origin URL"
                />
              </label>
            )}
            <PlainToggle
              label="Include unstaged"
              checked={options.includeUnstaged}
              onClick={options.toggleIncludeUnstaged}
              toggleSide="left"
            />
            <PlainToggle
              label="Include untracked"
              checked={includeUntracked}
              onClick={onToggleIncludeUntracked}
              toggleSide="left"
            />
            <PlainToggle
              label="Draft message"
              checked={options.previewEnabled}
              onClick={options.togglePreview}
              toggleSide="left"
            />
            <PlainToggle
              label="Commit & push"
              checked={options.pushEnabled}
              disabled={!hasOrigin}
              onClick={() => {
                const nextMode = options.pushEnabled ? 'commit' : 'commit-push'
                options.togglePush()
                void options.saveProjectMode(nextMode)
              }}
              toggleSide="left"
            />
            <PlainToggle
              label="Use app default"
              checked={usesAppDefault}
              onClick={() => void options.saveProjectMode(null)}
              toggleSide="left"
            />
          </PopoverPanel>
        ) : null}
      </div>
      {hasOrigin ? null : (
        <button
          type="button"
          className={cn(
            workspaceFooterTextClass,
            'composer-origin-control inline-flex h-7 items-center rounded-lg px-2.5 py-0 text-[color:var(--muted)] transition-colors duration-150 hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]',
          )}
          onClick={openOriginEditor}
          aria-label="Add GitHub origin"
          data-tooltip="Add GitHub origin"
        >
          Add origin
        </button>
      )}
    </>
  )
}
