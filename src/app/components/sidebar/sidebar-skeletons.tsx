import { SkeletonBlock } from '../common/skeleton'

const projectSkeletonRows = [
  'project-a',
  'project-b',
  'project-c',
  'project-d',
  'project-e',
  'project-f',
]
const chatSkeletonRows = ['chat-a', 'chat-b', 'chat-c', 'chat-d', 'chat-e']
const inboxSkeletonRows = ['inbox-a', 'inbox-b', 'inbox-c', 'inbox-d', 'inbox-e']

export function SidebarProjectsSkeleton() {
  return (
    <div
      className="sidebar-scroll-region"
      role="status"
      aria-label="Loading projects"
      aria-busy="true"
    >
      <div className="sidebar-list px-1 pt-1">
        {projectSkeletonRows.map((rowId, index) => (
          <div key={rowId} className="grid gap-1.5 py-1.5">
            <div className="grid h-7 grid-cols-[16px_minmax(0,1fr)_32px] items-center gap-2 px-1.5">
              <SkeletonBlock className="h-3.5 w-3.5 rounded-md" />
              <SkeletonBlock className="h-3.5 w-[min(9rem,80%)]" />
              <SkeletonBlock className="h-5 w-7 justify-self-end rounded-lg opacity-70" />
            </div>
            {index < 3 ? (
              <div className="ml-6 grid gap-1.5">
                <SkeletonBlock className="h-3 w-[72%] opacity-70" />
                <SkeletonBlock className="h-3 w-[56%] opacity-55" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SidebarChatSkeleton() {
  return (
    <div
      className="sidebar-scroll-region"
      role="status"
      aria-label="Loading chats"
      aria-busy="true"
    >
      <div className="sidebar-list px-1 pt-1">
        {chatSkeletonRows.map((rowId, index) => (
          <div key={rowId} className="grid gap-1.5 py-1.5">
            <div className="grid h-7 grid-cols-[16px_minmax(0,1fr)_24px] items-center gap-2 px-1.5">
              <SkeletonBlock className="h-3.5 w-3.5 rounded-md" />
              <SkeletonBlock className="h-3.5 w-[min(8rem,76%)]" />
              <SkeletonBlock className="h-4 w-5 justify-self-end rounded-md opacity-60" />
            </div>
            <div className="ml-6 grid gap-1.5">
              <SkeletonBlock className="h-3 w-[76%] opacity-70" />
              {index % 2 === 0 ? <SkeletonBlock className="h-3 w-[52%] opacity-55" /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SidebarInboxSkeleton() {
  return (
    <div
      className="sidebar-scroll-region"
      role="status"
      aria-label="Loading inbox"
      aria-busy="true"
    >
      <div className="sidebar-list px-1 pt-1">
        {inboxSkeletonRows.map((rowId, index) => (
          <div key={rowId} className="grid gap-1.5 rounded-xl px-1.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <SkeletonBlock className="h-3.5 w-[68%]" />
              <SkeletonBlock className="h-3 w-8 opacity-60" />
            </div>
            <SkeletonBlock className="h-3 w-[86%] opacity-65" />
            {index < 3 ? <SkeletonBlock className="h-3 w-[58%] opacity-45" /> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
