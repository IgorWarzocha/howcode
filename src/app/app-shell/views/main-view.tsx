import { getComingSoonViewContent } from '@howcode/roadmaps'
import { MarkdownContent } from '../../common/markdown-content'
import { ViewHeader } from '../../common/view-header'
import { ViewShell } from '../../common/view-shell'
import type { View } from '../../types'
import { appTypeReadableClass } from '../../ui/classes'

type MainViewProps = {
  activeView: View
}

export function MainView({ activeView }: MainViewProps) {
  if (activeView !== 'chat' && activeView !== 'claw' && activeView !== 'work') {
    return null
  }

  const content = getComingSoonViewContent(activeView)

  return (
    <ViewShell maxWidthClassName="max-w-[760px]">
      <ViewHeader title={content.title} subtitle={content.subtitle} />

      <MarkdownContent markdown={content.markdown} className={`gap-3 ${appTypeReadableClass}`} />
    </ViewShell>
  )
}
