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
  return (
    <div className="pointer-events-auto flex justify-end px-1 pb-1">
      <Select
        aria-label="Speaking as"
        title={selected?.description || 'Choose who is speaking'}
        className="max-w-48 text-sm"
        value={selected?.id ?? ''}
        onChange={(event) => {
          if (event.target.value === 'manage') onManage()
          else selectPerson(event.target.value)
        }}
      >
        {people.length === 0 ? <option value="">Default</option> : null}
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
        <option value="manage">Manage people…</option>
      </Select>
    </div>
  )
}
