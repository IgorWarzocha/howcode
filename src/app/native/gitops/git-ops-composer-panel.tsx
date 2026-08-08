import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { FolderGit2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { AppSettings, DesktopActionInvoker } from '../../desktop/types'
import { compactIconButtonClass, composerPanelClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import { ComposerGitOpsSurface } from './composer-git-ops-surface'
import type {
  GitOpsComposerDiff,
  GitOpsComposerProject,
  GitOpsFileTreeControl,
} from './git-ops-composer-contracts'
import { GitOpsErrorDetails } from './git-ops-error-details'
import type { GitOpsReviewController } from './review/review-controller'

type GitOpsComposerPanelProps = {
  appSettings: AppSettings
  diff: GitOpsComposerDiff
  fileTree: GitOpsFileTreeControl
  onAction: DesktopActionInvoker
  onBack: () => void
  onLayoutChange: () => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  onReviewSent: () => void
  project: GitOpsComposerProject
  review: GitOpsReviewController
}

export function GitOpsComposerPanel({
  appSettings,
  diff,
  fileTree,
  onAction,
  onBack,
  onLayoutChange,
  onOpenSettingsView,
  onReviewSent,
  project,
  review,
}: GitOpsComposerPanelProps) {
  const composerPanelRef = useRef<HTMLDivElement>(null)
  const [gitActionErrorMessage, setGitActionErrorMessage] = useState<string | null>(null)
  const [gitActionErrorDismissed, setGitActionErrorDismissed] = useState(false)
  const visibleGitActionErrorMessage =
    gitActionErrorMessage && !gitActionErrorDismissed ? gitActionErrorMessage : null

  return (
    <div className="relative grid w-full grid-cols-[2rem_minmax(0,1fr)_2rem] items-end gap-2 overflow-visible">
      <div className="relative col-start-2 grid min-w-0 gap-0 overflow-visible">
        {visibleGitActionErrorMessage ? (
          <GitOpsErrorDetails
            detail={visibleGitActionErrorMessage}
            onDismiss={() => setGitActionErrorDismissed(true)}
          />
        ) : null}
        <section
          ref={composerPanelRef}
          className={`${composerPanelClass} min-w-0`}
          aria-label="Git ops composer panel"
        >
          <ComposerGitOpsSurface
            appSettings={appSettings}
            composerPanelRef={composerPanelRef}
            diff={diff}
            onAction={onAction}
            onBack={onBack}
            onLayoutChange={onLayoutChange}
            onOpenSettingsView={onOpenSettingsView}
            onReviewSent={onReviewSent}
            project={project}
            review={review}
            onActionErrorMessageChange={(message) => {
              setGitActionErrorMessage(message)
              setGitActionErrorDismissed(false)
            }}
          />
        </section>
      </div>
      <div className="relative h-full min-h-0 w-8 shrink-0 self-stretch text-[color:var(--muted)]">
        <div className="absolute right-0 bottom-[3.35rem] flex w-7 items-center justify-center">
          <button
            type="button"
            className={cn(
              compactIconButtonClass,
              'h-7 w-7 shrink-0 rounded-md opacity-70 hover:opacity-100',
            )}
            onClick={fileTree.toggle}
            aria-label={fileTree.visible ? 'Hide changed files' : 'Show changed files'}
            data-tooltip={fileTree.visible ? 'Hide changed files' : 'Show changed files'}
          >
            <FolderGit2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
