import { lazy, Suspense } from 'react'
import type { AppSettings, DesktopActionInvoker } from '../../../src/app/desktop/types'
import { useToolkitExtensionEnabled } from '../../../src/app/extensions/toolkit-context'
import { viewSubtitleClass, viewTitleClass } from '../../../src/app/ui/classes'

const SkillsView = lazy(async () => {
  const module = await import('./management/skills-view')
  return { default: module.SkillsView }
})

export function SkillsWorkspaceView(props: {
  appSettings: AppSettings
  projectPath: string | null
  onSetProjectScopeActive: (active: boolean) => void
  onProjectTargetSelected: () => void
  onAction: DesktopActionInvoker
  onClose: () => void
}) {
  const enabled = useToolkitExtensionEnabled('skills')
  if (!enabled) return null
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid h-full w-full max-w-[760px] content-start gap-4 px-2 pt-6 pb-6">
          <div className="grid gap-1">
            <h1 className={viewTitleClass}>Skills</h1>
            <p className={viewSubtitleClass}>Loading skills…</p>
          </div>
        </div>
      }
    >
      <SkillsView {...props} />
    </Suspense>
  )
}
