import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { mainPanelClass } from '@howcode/ui/classes'
import type { ComponentProps } from 'react'
import { WORKSPACE_EDGE_PADDING_CLASS } from '../../../src/app/ui/layout'
import { DirectoryChatHistoryView } from './chat-history-view'

export function ChatHistoryWorkspaceView(props: ComponentProps<typeof DirectoryChatHistoryView>) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          'motion-terminal-drawer-offset absolute inset-x-0 top-0 overflow-hidden',
          WORKSPACE_EDGE_PADDING_CLASS,
        )}
        style={{ bottom: '0px' }}
      >
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden">
          <main className={mainPanelClass}>
            <DirectoryChatHistoryView {...props} />
          </main>
        </div>
      </div>
    </div>
  )
}
