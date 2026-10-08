import { FolderGit2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Tooltip } from '../../../../src/app/common/tooltip'
import type { AppSettings, DesktopActionInvoker } from '../../../../src/app/desktop/types'
import type { SettingsOpenTarget } from '../../../../src/app/settings/settings/settingsTypes'
import { compactIconButtonClass, composerPanelClass } from '../../../../src/app/ui/classes'
import { cn } from '../../../../src/app/utils/cn'
import type { WorkspacePresentationCloseConfirmation } from '../../../../src/app/workspace-shell/workspace-presentation'
import { ComposerGitOpsSurface } from './composer-git-ops-surface'
import type {
  GitOpsComposerDiff,
  GitOpsComposerDirectory,
  GitOpsFileTreeControl,
} from './git-ops-composer-contracts'
import { GitOpsErrorDetails } from './git-ops-error-details'
import type { GitOpsReviewController } from './review/review-controller'

type GitReviewPanelProps = {
  appSettings: AppSettings
  diff: GitOpsComposerDiff
  fileTree: GitOpsFileTreeControl
  onAction: DesktopActionInvoker
  onBack: () => void
  onLayoutChange: () => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  onReviewSent: () => void
  directory: GitOpsComposerDirectory
  review: GitOpsReviewController
  closeConfirmation: WorkspacePresentationCloseConfirmation
}

export function GitReviewPanel({
  appSettings,
  diff,
  fileTree,
  onAction,
  onBack,
  onLayoutChange,
  onOpenSettingsView,
  onReviewSent,
  directory,
  review,
  closeConfirmation,
}: GitReviewPanelProps) {
  const composerPanelRef = useRef<HTMLDivElement>(null)
  const [gitActionErrorMessage, setGitActionErrorMessage] = useState<string | null>(null)
  const [gitActionErrorDismissed, setGitActionErrorDismissed] = useState(false)
  const visibleGitActionErrorMessage =
    gitActionErrorMessage && !gitActionErrorDismissed ? gitActionErrorMessage : null

  return (
    <div className="git-review-panel relative grid w-full grid-cols-[minmax(0,1fr)_2rem] items-end gap-2 overflow-visible">
      <div className="relative grid min-w-0 gap-0 overflow-visible">
        {visibleGitActionErrorMessage ? (
          <GitOpsErrorDetails
            detail={visibleGitActionErrorMessage}
            onDismiss={() => setGitActionErrorDismissed(true)}
          />
        ) : null}
        <section
          ref={composerPanelRef}
          className={`${composerPanelClass} min-w-0`}
          aria-label="Git review controls"
        >
          <ComposerGitOpsSurface
            appSettings={appSettings}
            composerPanelRef={composerPanelRef}
            diff={diff}
            onAction={onAction}
            onBack={onBack}
            closeConfirmation={closeConfirmation}
            onLayoutChange={onLayoutChange}
            onOpenSettingsView={onOpenSettingsView}
            onReviewSent={onReviewSent}
            directory={directory}
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
          <Tooltip content={fileTree.visible ? 'Hide changed files' : 'Show changed files'}>
            <button
              type="button"
              className={cn(
                compactIconButtonClass,
                'h-7 w-7 shrink-0 rounded-md opacity-70 hover:opacity-100',
              )}
              onClick={fileTree.toggle}
              aria-label={fileTree.visible ? 'Hide changed files' : 'Show changed files'}
            >
              <FolderGit2 size={15} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
