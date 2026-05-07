import { CHAT_TEXT_MAX_WIDTH_CLASS } from '../../../ui/layout'
import { SkeletonBlock } from '../../common/skeleton'
import { chatScrollableAreaClass, chatViewportClass } from './thread-layout'

const MESSAGE_SHAPES = [
  { id: 'first-user', align: 'end', width: '58%', lines: [92, 64] },
  { id: 'first-assistant', align: 'start', width: '72%', lines: [84, 96, 70, 42] },
  { id: 'second-user', align: 'end', width: '48%', lines: [88] },
  { id: 'second-assistant', align: 'start', width: '68%', lines: [78, 94, 56] },
] as const

export function ThreadTimelineSkeleton({
  composerOverlayHeight = 0,
}: {
  composerOverlayHeight?: number
}) {
  return (
    <section
      className={`${chatViewportClass} relative`}
      aria-label="Loading conversation"
      aria-busy="true"
    >
      <div className={`${chatScrollableAreaClass} ml-[2.95rem] mr-[2.05rem]`}>
        <div
          className={`mx-auto flex min-h-full w-full min-w-0 flex-col justify-end ${CHAT_TEXT_MAX_WIDTH_CLASS} overflow-x-hidden px-4 pt-4 pb-4`}
          style={
            composerOverlayHeight > 0
              ? { paddingBottom: `calc(1rem + ${composerOverlayHeight}px)` }
              : undefined
          }
        >
          <div className="grid min-w-0 gap-4">
            {MESSAGE_SHAPES.map((message) => (
              <div key={message.id} className="grid gap-2" style={{ justifyItems: message.align }}>
                <SkeletonBlock className="h-3 w-24 rounded-md opacity-45" />
                <div
                  className="grid gap-2 rounded-[18px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.018)] px-4 py-3"
                  style={{ width: message.width }}
                >
                  {message.lines.map((width) => (
                    <SkeletonBlock
                      key={`${message.id}-${width}`}
                      className="h-3 rounded-md opacity-70"
                      style={{ width: `${width}%` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
