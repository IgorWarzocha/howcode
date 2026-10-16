import { Button, Select } from '@howaboua/howcode-sdk/ui/controls'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useId, useRef, useState } from 'react'
import type { ProviderAccount } from '../../../../shared/provider-auth'
import { requestProviderAuth } from './providerAuthClient'
import { ProviderLoginNotices, ProviderLoginPrompt } from './providerLoginPrompt'
import { useProviderLogin } from './useProviderLogin'

const accountsKey = ['provider-accounts'] as const

function ProviderAccountPicker({
  accounts,
  directory,
  selected,
  disabled,
  onChange,
}: {
  accounts: readonly ProviderAccount[]
  directory: string
  selected: string
  disabled: boolean
  onChange: (id: string) => void
}) {
  const id = useId()
  return (
    <>
      <label htmlFor={id} className="text-sm">
        Provider
      </label>
      <Select
        id={id}
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Choose a provider</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
            {account.source ? ' — configured' : ''}
          </option>
        ))}
      </Select>
      <p className="break-all text-xs text-[color:var(--muted)]">
        Credentials are shared with Pi in {directory}.
      </p>
    </>
  )
}

function ProviderAccountControls({
  provider,
  busy,
  status,
  start,
  logout,
}: {
  provider: ProviderAccount
  busy: boolean
  status: { status: 'idle' | 'busy' | 'error' | 'success'; message: string }
  start: (authType: 'api_key' | 'oauth') => void
  logout: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <p role={status.status === 'error' ? 'alert' : 'status'} className="text-sm">
        {status.message}
      </p>
      {provider.methods.map((method) => (
        <Button key={method.type} disabled={busy} onClick={() => start(method.type)}>
          {method.label}
        </Button>
      ))}
      {provider.stored ? (
        <Button disabled={busy} onClick={logout}>
          Sign out
        </Button>
      ) : null}
      {provider.methods.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">
          Configure this provider through its environment or credential files on the server.
        </p>
      ) : null}
    </div>
  )
}

export function SettingsProviderAccounts() {
  const queryClient = useQueryClient()
  const accounts = useQuery({
    queryKey: accountsKey,
    queryFn: async () => {
      const result = await requestProviderAuth({ operation: 'list' })
      if (result.type !== 'accounts') throw new Error('Unexpected provider accounts response.')
      return result
    },
    staleTime: 0,
    retry: false,
  })
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: accountsKey })
    void queryClient.invalidateQueries({ queryKey: ['desktop', 'composerState'] })
  }, [queryClient])
  const login = useProviderLogin(refresh)
  const [selected, setSelected] = useState('')
  const [logoutStatus, setLogoutStatus] = useState<{
    status: 'idle' | 'busy' | 'error' | 'success'
    message: string
  }>({ status: 'idle', message: '' })
  const logoutPending = useRef(false)
  const provider = accounts.data?.accounts.find((account) => account.id === selected)
  const running = login.session?.status === 'running'
  const busy = login.busy || logoutStatus.status === 'busy'
  const logout = async () => {
    if (!provider || logoutPending.current) return
    if (
      !window.confirm(
        `Remove the saved credential for ${provider.name}? Other apps using this Pi directory will also be signed out. Environment credentials are unchanged.`,
      )
    )
      return
    logoutPending.current = true
    setLogoutStatus({ status: 'busy', message: 'Signing out…' })
    try {
      const result = await requestProviderAuth({ operation: 'logout', provider: provider.id })
      if (result.type !== 'accounts') throw new Error('Unexpected provider accounts response.')
      queryClient.setQueryData(accountsKey, result)
      refresh()
      setLogoutStatus({ status: 'success', message: 'Saved credential removed.' })
    } catch (failure) {
      setLogoutStatus({
        status: 'error',
        message: failure instanceof Error ? failure.message : 'Could not sign out.',
      })
    } finally {
      logoutPending.current = false
    }
  }
  return (
    <div className="grid w-full gap-3 sm:w-96">
      {accounts.isPending ? (
        <p role="status" className="text-sm">
          Loading provider accounts…
        </p>
      ) : null}
      {accounts.error ? (
        <div role="alert" className="text-sm">
          <p>{accounts.error.message}</p>
          <Button onClick={() => void accounts.refetch()}>Retry</Button>
        </div>
      ) : null}
      {accounts.data ? (
        <>
          <ProviderAccountPicker
            accounts={accounts.data.accounts}
            directory={accounts.data.directory}
            selected={selected}
            disabled={running || busy}
            onChange={(value) => {
              setSelected(value)
              setLogoutStatus({ status: 'idle', message: '' })
            }}
          />
          {provider ? (
            <>
              <p className="text-sm">
                {provider.source ? `Configured: ${provider.source}` : 'Not configured.'}
              </p>
              {running ? null : (
                <ProviderAccountControls
                  provider={provider}
                  busy={busy}
                  status={logoutStatus}
                  start={(type) => {
                    setLogoutStatus({ status: 'idle', message: '' })
                    void login.start(provider.id, type)
                  }}
                  logout={() => void logout()}
                />
              )}
            </>
          ) : null}
        </>
      ) : null}
      <ProviderLoginInteraction login={login} />
    </div>
  )
}

function ProviderLoginInteraction({ login }: { login: ReturnType<typeof useProviderLogin> }) {
  return (
    <>
      {login.error ? (
        <p role="alert" className="text-sm">
          {login.error}
        </p>
      ) : null}
      {login.session ? <ProviderLoginNotices session={login.session} /> : null}
      {login.session?.status === 'running' ? (
        <>
          {login.session.prompt ? (
            <ProviderLoginPrompt
              key={login.session.prompt.id}
              prompt={login.session.prompt}
              busy={login.busy}
              answer={login.answer}
            />
          ) : null}
          <Button disabled={login.busy} onClick={() => void login.cancel()}>
            Cancel sign-in
          </Button>
        </>
      ) : null}
    </>
  )
}
