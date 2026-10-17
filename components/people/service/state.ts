import { randomUUID } from 'node:crypto'
import * as Schema from 'effect/Schema'
import { loadAppSettings } from '../../../desktop/app-settings/readers.ts'
import { setPeople } from '../../../desktop/app-settings/writers.ts'
import { PeopleUpdateSchema, type Person } from '../../../shared/people.ts'

export function updatePeople(value: unknown) {
  const update = Schema.decodeUnknownSync(PeopleUpdateSchema)(value)
  const people = loadAppSettings().people
  if (update.operation === 'remove') {
    setPeople(people.filter((current) => current.id !== update.id))
    return
  }
  if (update.person.id !== undefined && !people.some((current) => current.id === update.person.id))
    throw new Error('This person no longer exists. Refresh People before editing.')
  const person = {
    ...update.person,
    id: update.person.id ?? randomUUID(),
    name: update.person.name.trim(),
    description: update.person.description.trim(),
  }
  if (!(person.name && person.id.trim())) throw new Error('A person needs an ID and name.')
  if (
    people.some(
      (current) =>
        current.id !== person.id && current.name.trim().toLowerCase() === person.name.toLowerCase(),
    )
  )
    throw new Error('A person with this name already exists.')
  setPeople(
    people.some((current) => current.id === person.id)
      ? people.map((current) => (current.id === person.id ? person : current))
      : [...people, person],
  )
}

export function resolvePerson(personId: string | undefined): Person | undefined {
  const people = loadAppSettings().people
  if (personId === undefined) {
    if (people.length > 1) throw new Error('Select a person before sending.')
    return people[0] ? { ...people[0] } : undefined
  }
  const person = people.find((current) => current.id === personId)
  if (!person) throw new Error('This person no longer exists. Select a person before sending.')
  return { ...person }
}
