import { useSyncExternalStore } from 'react'
import type { Person } from '../../../shared/people'

const storageKey = 'howcode.person'
const selectionEvent = 'howcode-person-change'
let memorySelection: string | null = null

function readSelection() {
  try {
    return sessionStorage.getItem(storageKey) ?? memorySelection
  } catch {
    return memorySelection
  }
}

function subscribe(listener: () => void) {
  window.addEventListener(selectionEvent, listener)
  return () => window.removeEventListener(selectionEvent, listener)
}

export function selectPerson(id: string) {
  memorySelection = id
  try {
    sessionStorage.setItem(storageKey, id)
  } catch {
    // Keep selection for this page when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(selectionEvent))
}

export function getSelectedPersonId(people: readonly Person[]) {
  return people.find((person) => person.id === readSelection())?.id ?? people[0]?.id
}

export function useSelectedPerson(people: readonly Person[]) {
  const id = useSyncExternalStore(subscribe, readSelection, () => null)
  return people.find((person) => person.id === id) ?? people[0]
}
