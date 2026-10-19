import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

type SidebarToggleProps = {
  sidebarAvailable: boolean
  sidebarCollapsed: boolean
  sidebarCompactMode: boolean
  onToggleSidebar: () => void
}

export function SidebarToggleButton({
  sidebarAvailable,
  sidebarCollapsed,
  sidebarCompactMode,
  onToggleSidebar,
}: SidebarToggleProps) {
  if (!sidebarAvailable) return null
  const sidebarHidden = sidebarCollapsed || sidebarCompactMode
  const label = sidebarHidden ? 'Show sidebar' : 'Hide sidebar'
  return (
    <button
      type="button"
      className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] hover:opacity-100"
      onClick={onToggleSidebar}
      aria-label={label}
      data-tooltip={label}
      data-tooltip-placement="right"
    >
      {sidebarHidden ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
    </button>
  )
}

export function SidebarFooter(props: SidebarToggleProps) {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-4">
      <div className="pointer-events-auto mb-1.5">
        <SidebarToggleButton {...props} />
      </div>
    </footer>
  )
}
