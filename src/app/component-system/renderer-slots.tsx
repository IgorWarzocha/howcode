import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'

type Slot = { id: string; element: HTMLElement; children: ReactNode }
const empty: Slot[] = []

/** Portal placement preserves the owning Provider without reparenting the app. */
function createRendererSlots() {
  const slots = new Map<string, Map<string, Slot>>()
  const snapshots = new Map<string, Slot[]>()
  const listeners = new Map<string, Set<() => void>>()
  const publish = (name: string) => {
    snapshots.set(name, [...(slots.get(name)?.values() ?? [])])
    for (const listener of listeners.get(name) ?? []) listener()
  }
  return {
    snapshot: (name: string) => snapshots.get(name) ?? empty,
    subscribe(name: string, listener: () => void) {
      const group = listeners.get(name) ?? new Set<() => void>()
      listeners.set(name, group)
      group.add(listener)
      return () => {
        group.delete(listener)
        if (group.size === 0) listeners.delete(name)
      }
    },
    register(name: string, slot: Slot) {
      const group = slots.get(name) ?? new Map<string, Slot>()
      slots.set(name, group)
      group.set(slot.id, slot)
      publish(name)
      return () => {
        if (group.get(slot.id) !== slot) return
        group.delete(slot.id)
        if (group.size === 0) slots.delete(name)
        publish(name)
      }
    },
  }
}
const RendererSlotsContext = createContext<ReturnType<typeof createRendererSlots> | null>(null)
function useRendererSlots() {
  const slots = useContext(RendererSlotsContext)
  if (!slots) throw new Error('Installed component placement host is unavailable.')
  return slots
}

export function RendererSlotsProvider({ children }: { children: ReactNode }) {
  const [slots] = useState(createRendererSlots)
  return <RendererSlotsContext value={slots}>{children}</RendererSlotsContext>
}

export function RendererSlot({ name, children }: { name: string; children: ReactNode }) {
  const slots = useRendererSlots()
  const id = useId()
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(
    () => (element ? slots.register(name, { id, element, children }) : undefined),
    [slots, name, id, element, children],
  )
  return <div ref={setElement} style={{ display: 'contents' }} />
}

export function ComponentRendererSlots({ name }: { name: string }) {
  const slots = useRendererSlots()
  const mounted = useSyncExternalStore(
    (listener) => slots.subscribe(name, listener),
    () => slots.snapshot(name),
  )
  return <>{mounted.map(({ id, element, children }) => createPortal(children, element, id))}</>
}
