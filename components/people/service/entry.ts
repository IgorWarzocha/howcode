import { defineEntry } from '@earendil-works/pi-durable'
import { type Person, personInputKind } from '../../../shared/people.ts'

/** The author is admission-time data, not a reference to the mutable People directory. */
export const PersonInputEntry = defineEntry<{ author: Person; modelContextBlocks: 1 }>(
  personInputKind,
)
