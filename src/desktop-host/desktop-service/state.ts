import type { DesktopServiceState, ServiceRecord } from './types'

export function updateMap<K, V>(source: ReadonlyMap<K, V>, update: (copy: Map<K, V>) => void) {
  const copy = new Map(source)
  update(copy)
  return copy
}

export function makeDesktopServiceState<Process>(): DesktopServiceState<Process> {
  return { current: null, nextRecordId: 1 }
}

export function updateCurrent<Process>(
  state: DesktopServiceState<Process>,
  recordId: number,
  update: (record: ServiceRecord<Process>) => ServiceRecord<Process>,
) {
  return state.current?.id === recordId ? { ...state, current: update(state.current) } : state
}

export function detachCurrent<Process>(state: DesktopServiceState<Process>, recordId: number) {
  return state.current?.id === recordId ? { ...state, current: null } : state
}
