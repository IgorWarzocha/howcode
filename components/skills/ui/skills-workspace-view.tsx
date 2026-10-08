import { viewSubtitleClass, viewTitleClass } from '@howcode/ui/classes'
import { lazy, Suspense } from 'react'
import { useToolkitComponentEnabled } from '../../../src/app/component-system/component-context'
import type { AppSettings, DesktopActionInvoker } from '../../../src/app/desktop/types'

const SkillsView = lazy(async () => {
  const module = await import('./management/skills-view')
  return { default: module.SkillsView }
})

export function SkillsWorkspaceView(props: {
  appSettings: AppSettings
  directoryPath: string | null
  onSetDirectoryScopeActive: (active: boolean) => void
  onDirectoryTargetSelected: () => void
  onAction: DesktopActionInvoker
  onClose: () => void
}) {
  const enabled = useToolkitComponentEnabled('skills')
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
