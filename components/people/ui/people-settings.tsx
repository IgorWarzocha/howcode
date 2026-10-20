import { Button, Input } from '@howaboua/howcode-sdk/ui/controls'
import type { SettingDescriptor } from '@howcode/settings/settingsTypes'
import { useId, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../shared/desktop-contracts'
import type { PeopleUpdate, Person } from '../../../shared/people'

function PersonForm({ person, onAction }: { person?: Person; onAction: DesktopActionInvoker }) {
  const id = useId()
  const [name, setName] = useState(person?.name ?? '')
  const [description, setDescription] = useState(person?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function save(value: PeopleUpdate) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const result = await onAction('settings.update', { key: 'people', value })
      if (!result?.ok || result.result?.error) {
        throw new Error(result?.result?.error || 'Could not save this person. Try again.')
      }
      if (!person) {
        setName('')
        setDescription('')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this person.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <form
      aria-label={person ? `Edit ${person.name}` : 'Add person'}
      className="grid gap-3 border-b border-[color:var(--border)] py-4 last:border-0"
      onSubmit={(event) => {
        event.preventDefault()
        void save({
          operation: 'upsert',
          person: {
            ...(person ? { id: person.id } : {}),
            name: name.trim(),
            description: description.trim(),
          },
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(8rem,1fr)_minmax(0,2fr)]">
        <label className="grid gap-1 text-sm" htmlFor={`${id}-name`}>
          Name
          <Input
            id={`${id}-name`}
            required
            maxLength={100}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm" htmlFor={`${id}-description`}>
          Short description
          <Input
            id={`${id}-description`}
            maxLength={200}
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p role="alert" className="text-sm empty:hidden">
          {error}
        </p>
        {person ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void save({ operation: 'remove', id: person.id })}
          >
            Remove
          </Button>
        ) : null}
        <Button type="submit" disabled={busy}>
          {person ? 'Save' : 'Add person'}
        </Button>
      </div>
    </form>
  )
}

function PeopleSettings({
  people,
  onAction,
}: {
  people: readonly Person[]
  onAction: DesktopActionInvoker
}) {
  return (
    <div className="w-full min-w-0">
      <h3 className="text-sm">People</h3>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Short descriptions help the agent know who it is talking to.
      </p>
      {people.map((person) => (
        <PersonForm key={person.id} person={person} onAction={onAction} />
      ))}
      <PersonForm onAction={onAction} />
    </div>
  )
}

export function buildPeopleSettingsDescriptor(
  people: readonly Person[],
  onAction: DesktopActionInvoker,
): SettingDescriptor {
  return {
    id: 'general.people',
    category: 'general',
    title: 'People',
    description:
      'Names and short descriptions the agent can see. With multiple people, choose who is speaking in the composer toolbar.',
    layout: 'rows',
    keywords: 'humans person speaker identity',
    render: () => <PeopleSettings people={people} onAction={onAction} />,
  }
}
