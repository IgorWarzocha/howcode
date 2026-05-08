import { useEffect, useState } from 'react'
import type {
  HowcodeRemoteEnvironment,
  HowcodeRemoteEnvironmentInput,
} from '../../../../shared/howcode-server-contracts'
import { composerTextActionButtonClass, settingsInputClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SettingDescriptor } from './settingsTypes'

type Draft = {
  kind: 'direct' | 'ssh'
  name: string
  serverUrl: string
  token: string
  sshHost: string
  localPort: string
  remotePort: string
  remoteCommand: string
}

const defaultDraft: Draft = {
  kind: 'ssh',
  localPort: '49317',
  name: '',
  remoteCommand: '',
  remotePort: '39317',
  serverUrl: '',
  sshHost: '',
  token: '',
}

function parsePort(value: string) {
  const port = Number.parseInt(value, 10)
  return Number.isInteger(port) ? port : null
}

function toInput(draft: Draft): HowcodeRemoteEnvironmentInput {
  return {
    kind: draft.kind,
    localPort: draft.kind === 'ssh' ? parsePort(draft.localPort) : null,
    name: draft.name.trim() || (draft.kind === 'ssh' ? draft.sshHost : draft.serverUrl),
    remoteCommand: draft.kind === 'ssh' ? draft.remoteCommand : null,
    remotePort: draft.kind === 'ssh' ? parsePort(draft.remotePort) : null,
    serverUrl: draft.kind === 'direct' ? draft.serverUrl : null,
    sshHost: draft.kind === 'ssh' ? draft.sshHost : null,
    token: draft.token,
  }
}

function RemoteEnvironmentSettings() {
  const [environments, setEnvironments] = useState<HowcodeRemoteEnvironment[]>([])
  const [draft, setDraft] = useState<Draft>(defaultDraft)
  const [status, setStatus] = useState<string | null>(null)

  const refresh = () => {
    void window.piDesktop?.listHowcodeRemoteEnvironments?.().then(setEnvironments)
  }

  useEffect(refresh, [])

  const save = async () => {
    setStatus(null)
    try {
      const saved = await window.piDesktop?.saveHowcodeRemoteEnvironment?.(toInput(draft))
      if (saved) {
        setStatus(`Saved ${saved.name}.`)
        setDraft(defaultDraft)
        refresh()
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save remote environment.')
    }
  }

  const remove = async (id: string) => {
    await window.piDesktop?.deleteHowcodeRemoteEnvironment?.(id)
    refresh()
  }

  return (
    <div className="w-[34rem] max-w-full space-y-4 text-[12px] text-[color:var(--muted)]">
      <p>
        Howcode uses your existing SSH config and ssh-agent. It stores host aliases and server
        metadata, but never stores SSH keys or passwords. Server tokens are stored separately as
        encrypted credentials.
      </p>

      <div className="flex gap-2">
        {(['ssh', 'direct'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            className={cn(
              composerTextActionButtonClass,
              draft.kind === kind && 'border-[color:var(--accent-border)] text-[color:var(--text)]',
            )}
            onClick={() => setDraft((current) => ({ ...current, kind }))}
          >
            {kind === 'ssh' ? 'SSH' : 'Direct URL'}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className={settingsInputClass}
          placeholder="Name"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        />
        <input
          className={settingsInputClass}
          placeholder="Server token"
          type="password"
          value={draft.token}
          onChange={(event) => setDraft((current) => ({ ...current, token: event.target.value }))}
        />
        {draft.kind === 'ssh' ? (
          <>
            <input
              className={settingsInputClass}
              placeholder="SSH host alias, e.g. lanbox"
              value={draft.sshHost}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sshHost: event.target.value }))
              }
            />
            <input
              className={settingsInputClass}
              placeholder="Local port"
              value={draft.localPort}
              onChange={(event) =>
                setDraft((current) => ({ ...current, localPort: event.target.value }))
              }
            />
            <input
              className={settingsInputClass}
              placeholder="Remote port"
              value={draft.remotePort}
              onChange={(event) =>
                setDraft((current) => ({ ...current, remotePort: event.target.value }))
              }
            />
            <input
              className={settingsInputClass}
              placeholder="Remote command override (optional)"
              value={draft.remoteCommand}
              onChange={(event) =>
                setDraft((current) => ({ ...current, remoteCommand: event.target.value }))
              }
            />
          </>
        ) : (
          <input
            className={cn(settingsInputClass, 'sm:col-span-2')}
            placeholder="http://127.0.0.1:39317"
            value={draft.serverUrl}
            onChange={(event) =>
              setDraft((current) => ({ ...current, serverUrl: event.target.value }))
            }
          />
        )}
      </div>

      <button type="button" className={composerTextActionButtonClass} onClick={save}>
        Save remote
      </button>
      {status ? <div>{status}</div> : null}

      <div className="space-y-2">
        {environments.map((environment) => (
          <div
            key={environment.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-[color:var(--text)]">{environment.name}</div>
              <div className="truncate">
                {environment.kind === 'ssh'
                  ? `ssh ${environment.sshHost ?? ''} → 127.0.0.1:${environment.localPort ?? ''}`
                  : environment.serverUrl}
                {environment.hasToken ? ' · token saved' : ' · no token'}
              </div>
            </div>
            <button
              type="button"
              className={composerTextActionButtonClass}
              onClick={() => void remove(environment.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function buildRemoteSettingsDescriptors(): SettingDescriptor[] {
  return [
    {
      category: 'remote',
      description: 'Remote Howcode servers and SSH-managed environments.',
      id: 'remote.environments',
      keywords: 'remote ssh server lan environment token',
      render: () => <RemoteEnvironmentSettings />,
      title: 'Remote environments',
    },
  ]
}
