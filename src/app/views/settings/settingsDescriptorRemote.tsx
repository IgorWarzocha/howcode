import { Loader2, PlugZap } from 'lucide-react'
import { useEffect, useState } from 'react'
import type {
  HowcodeRemoteEnvironment,
  HowcodeRemoteEnvironmentInput,
} from '../../../../shared/howcode-server-contracts'
import { Tooltip } from '../../components/common/tooltip'
import { composerTextActionButtonClass, settingsInputClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SettingDescriptor } from './settingsTypes'

type Draft = {
  kind: 'direct' | 'ssh'
  label: string
  serverUrl: string
  token: string
  sshHost: string
  localPort: string
  remotePort: string
  remoteCommand: string
}

type RemoteStore = {
  draft: Draft
  environments: HowcodeRemoteEnvironment[]
  status: string | null
  testStatusById: Record<string, 'failed' | 'testing' | 'ok'>
  testErrorById: Record<string, string>
  testSuccessById: Record<string, string>
  version: number
}

const defaultDraft: Draft = {
  kind: 'ssh',
  label: '',
  localPort: '49317',
  remoteCommand: '',
  remotePort: '39317',
  serverUrl: '',
  sshHost: '',
  token: '',
}

const remoteStore: RemoteStore = {
  draft: defaultDraft,
  environments: [],
  status: null,
  testErrorById: {},
  testStatusById: {},
  testSuccessById: {},
  version: 0,
}

const listeners = new Set<() => void>()
let didLoadRemoteEnvironments = false

function emitRemoteStoreChange() {
  remoteStore.version += 1
  for (const listener of listeners) listener()
}

function updateDraft(patch: Partial<Draft>) {
  remoteStore.draft = { ...remoteStore.draft, ...patch }
  emitRemoteStoreChange()
}

function setStatus(status: string | null) {
  remoteStore.status = status
  emitRemoteStoreChange()
}

function setTestStatus(
  id: string,
  status: 'failed' | 'testing' | 'ok',
  error: string | null = null,
  success: string | null = null,
) {
  remoteStore.testStatusById = { ...remoteStore.testStatusById, [id]: status }
  remoteStore.testErrorById = { ...remoteStore.testErrorById, [id]: error ?? '' }
  remoteStore.testSuccessById = { ...remoteStore.testSuccessById, [id]: success ?? '' }
  emitRemoteStoreChange()
}

function parsePort(value: string) {
  const port = Number.parseInt(value, 10)
  return Number.isInteger(port) ? port : null
}

function toInput(draft: Draft): HowcodeRemoteEnvironmentInput {
  return {
    kind: draft.kind,
    localPort: draft.kind === 'ssh' ? parsePort(draft.localPort) : null,
    name: draft.label.trim() || (draft.kind === 'ssh' ? draft.sshHost : draft.serverUrl),
    remoteCommand: draft.kind === 'ssh' ? draft.remoteCommand : null,
    remotePort: draft.kind === 'ssh' ? parsePort(draft.remotePort) : null,
    serverUrl: draft.kind === 'direct' ? draft.serverUrl : null,
    sshHost: draft.kind === 'ssh' ? draft.sshHost : null,
    token: draft.token,
  }
}

function refreshRemoteEnvironments() {
  void window.piDesktop?.listHowcodeRemoteEnvironments?.().then((environments) => {
    remoteStore.environments = environments
    emitRemoteStoreChange()
  })
}

function useRemoteSettingsStore() {
  const [, setVersion] = useState(remoteStore.version)

  useEffect(() => {
    const listener = () => setVersion(remoteStore.version)
    listeners.add(listener)
    if (!didLoadRemoteEnvironments) {
      didLoadRemoteEnvironments = true
      refreshRemoteEnvironments()
    }
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return remoteStore
}

function RemoteKindControl() {
  const { draft } = useRemoteSettingsStore()
  return (
    <div className="flex justify-end gap-2">
      {(['ssh', 'direct'] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          className={cn(
            composerTextActionButtonClass,
            draft.kind === kind && 'border-[color:var(--accent-border)] text-[color:var(--text)]',
          )}
          onClick={() => updateDraft({ kind })}
        >
          {kind === 'ssh' ? 'SSH' : 'Direct URL'}
        </button>
      ))}
    </div>
  )
}

function RemoteTextInput({
  field,
  placeholder,
  type = 'text',
}: {
  field: keyof Draft
  placeholder: string
  type?: 'password' | 'text'
}) {
  const { draft } = useRemoteSettingsStore()
  return (
    <input
      className={cn(settingsInputClass, 'h-8 w-[18rem] max-w-full flex-none py-0')}
      placeholder={placeholder}
      type={type}
      value={draft[field]}
      onChange={(event) => updateDraft({ [field]: event.target.value })}
    />
  )
}

function ConditionalRemoteTextInput(
  props: Parameters<typeof RemoteTextInput>[0] & { kind: Draft['kind'] },
) {
  const { draft } = useRemoteSettingsStore()
  if (draft.kind !== props.kind) {
    return <div className="invisible h-8 w-[18rem] max-w-full" aria-hidden="true" />
  }
  return <RemoteTextInput {...props} />
}

function SaveRemoteControl() {
  const { draft } = useRemoteSettingsStore()
  const save = async () => {
    setStatus(null)
    try {
      const saved = await window.piDesktop?.saveHowcodeRemoteEnvironment?.(toInput(draft))
      if (!saved) return
      remoteStore.draft = defaultDraft
      setStatus(`Saved ${saved.name}.`)
      refreshRemoteEnvironments()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save remote environment.')
    }
  }

  return (
    <div className="grid justify-end gap-2 text-right text-[12px] text-[color:var(--muted)]">
      <button type="button" className={composerTextActionButtonClass} onClick={save}>
        Save remote
      </button>
    </div>
  )
}

function getRemoteTestTooltip(
  environment: HowcodeRemoteEnvironment,
  error: string,
  success: string,
) {
  return error || success || `Check ${environment.name}`
}

function SavedRemoteEnvironmentsControl() {
  const { environments, testErrorById, testStatusById, testSuccessById } = useRemoteSettingsStore()
  const remove = async (id: string) => {
    await window.piDesktop?.deleteHowcodeRemoteEnvironment?.(id)
    refreshRemoteEnvironments()
  }
  const test = async (environment: HowcodeRemoteEnvironment) => {
    if (!environment.hasToken) {
      setTestStatus(environment.id, 'failed', 'Add token, save, then test.')
      return
    }
    setTestStatus(environment.id, 'testing')
    try {
      const result = await window.piDesktop?.testHowcodeRemoteEnvironment?.(environment.id)
      setTestStatus(
        environment.id,
        result?.ok ? 'ok' : 'failed',
        result?.error ?? 'Connection failed.',
        result?.ok
          ? `Connected to ${result.instanceName ?? environment.name} · ${result.projectCount ?? 0} projects`
          : null,
      )
    } catch (error) {
      setTestStatus(
        environment.id,
        'failed',
        error instanceof Error ? error.message : 'Connection failed.',
      )
    }
  }

  if (environments.length === 0) {
    return <span className="text-[12px] text-[color:var(--muted)]">No remotes saved.</span>
  }

  return (
    <div className="grid w-[32rem] max-w-full gap-1.5">
      {environments.map((environment) => (
        <div
          key={environment.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-[11.5px]"
        >
          <div className="min-w-0">
            <div className="truncate text-[color:var(--text)]">{environment.name}</div>
            <div className="truncate text-[color:var(--muted)]">
              {environment.kind === 'ssh'
                ? `ssh ${environment.sshHost ?? ''} → 127.0.0.1:${environment.localPort ?? ''}`
                : environment.serverUrl}
              {environment.hasToken ? ' · token saved' : ' · no token'}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip
              content={getRemoteTestTooltip(
                environment,
                testErrorById[environment.id] ?? '',
                testSuccessById[environment.id] ?? '',
              )}
              placement="left"
              className="inline-flex"
              contentClassName="[--tooltip-width:max-content] [--tooltip-max-width:min(90vw,44rem)] [--tooltip-white-space:nowrap] [--tooltip-overflow-wrap:normal] text-left"
            >
              <button
                type="button"
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--panel-2)] p-0 text-[color:var(--text)] transition-colors hover:border-[color:var(--accent-border)] hover:bg-[color:var(--accent-bg-subtle)]',
                  testStatusById[environment.id] === 'ok' && 'border-[color:var(--success)]',
                  testStatusById[environment.id] === 'failed' && 'border-[color:var(--danger)]',
                )}
                onClick={() => void test(environment)}
                aria-label={`Test ${environment.name}`}
              >
                {testStatusById[environment.id] === 'testing' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <PlugZap size={12} />
                )}
              </button>
            </Tooltip>
            <button
              type="button"
              className={cn(composerTextActionButtonClass, 'px-2')}
              onClick={() => void remove(environment.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function buildRemoteSettingsDescriptors(): SettingDescriptor[] {
  return [
    {
      category: 'remote',
      description: 'SSH tunnel or direct URL.',
      id: 'remote.kind',
      keywords: 'remote ssh server lan environment',
      render: () => <RemoteKindControl />,
      title: 'Remote type',
    },
    {
      category: 'remote',
      description: 'Optional. Falls back to host or URL.',
      id: 'remote.label',
      keywords: 'remote name label alias',
      render: () => <RemoteTextInput field="label" placeholder="Label (optional)" />,
      title: 'Label',
    },
    {
      category: 'remote',
      description: 'Server token. Stored encrypted.',
      id: 'remote.token',
      keywords: 'remote token secret auth',
      render: () => <RemoteTextInput field="token" placeholder="Server token" type="password" />,
      title: 'Token',
    },
    {
      category: 'remote',
      description: 'Host from ~/.ssh/config, e.g. lanbox.',
      id: 'remote.ssh-host',
      keywords: 'remote ssh host alias config agent key',
      render: () => (
        <ConditionalRemoteTextInput kind="ssh" field="sshHost" placeholder="SSH host alias" />
      ),
      title: 'SSH host alias',
    },
    {
      category: 'remote',
      description: 'Local tunnel port.',
      id: 'remote.local-port',
      keywords: 'remote ssh local port tunnel forward',
      render: () => <ConditionalRemoteTextInput kind="ssh" field="localPort" placeholder="49317" />,
      title: 'Local port',
    },
    {
      category: 'remote',
      description: 'Remote howcode serve port.',
      id: 'remote.remote-port',
      keywords: 'remote ssh remote port serve',
      render: () => (
        <ConditionalRemoteTextInput kind="ssh" field="remotePort" placeholder="39317" />
      ),
      title: 'Remote port',
    },
    {
      category: 'remote',
      description: 'Optional remote startup command.',
      id: 'remote.command',
      keywords: 'remote ssh command serve override',
      render: () => (
        <ConditionalRemoteTextInput
          kind="ssh"
          field="remoteCommand"
          placeholder="Remote command override (optional)"
        />
      ),
      title: 'Remote command',
    },
    {
      category: 'remote',
      description: 'Server URL.',
      id: 'remote.url',
      keywords: 'remote direct url server http',
      render: () => (
        <ConditionalRemoteTextInput
          kind="direct"
          field="serverUrl"
          placeholder="http://127.0.0.1:39317"
        />
      ),
      title: 'Server URL',
    },
    {
      category: 'remote',
      description: 'Save this remote.',
      id: 'remote.save',
      keywords: 'remote save add environment',
      render: () => <SaveRemoteControl />,
      title: 'Save remote',
    },
    {
      category: 'remote',
      description: 'Saved remotes.',
      id: 'remote.saved',
      keywords: 'remote saved environments delete',
      render: () => <SavedRemoteEnvironmentsControl />,
      title: 'Saved remotes',
    },
  ]
}
