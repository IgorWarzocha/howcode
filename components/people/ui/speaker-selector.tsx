import { Select } from '@howaboua/howcode-sdk/ui/controls'
import type { Person } from '../../../shared/people'
import { selectPerson, useSelectedPerson } from './speaker-selection'

export function SpeakerSelector({
  people,
  onManage,
}: {
  people: readonly Person[]
  onManage: () => void
}) {
  const selected = useSelectedPerson(people)
  if (people.length < 2) return null
  return (
    <Select
      aria-label="Speaking as"
      title={selected?.description || 'Choose who is speaking'}
      className="h-7 max-w-36 border-transparent bg-transparent py-0 text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
      value={selected?.id ?? ''}
      onChange={(event) => {
        if (event.target.value === 'manage') onManage()
        else selectPerson(event.target.value)
      }}
    >
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {person.name}
        </option>
      ))}
      <option value="manage">Manage people…</option>
    </Select>
  )
}
