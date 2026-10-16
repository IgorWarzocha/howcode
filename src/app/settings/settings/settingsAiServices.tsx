import { Button, Select } from '@howaboua/howcode-sdk/ui/controls'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import type { ProviderAccount } from '../../../../shared/provider-auth'
import { requestProviderAuth } from './providerAuthClient'
import { ProviderLoginNotices, ProviderLoginPrompt } from './providerLoginPrompt'
import { SettingRow } from './setting-row'
import { settingRowClass } from './settingsClasses'
import { useProviderLogin } from './useProviderLogin'

const accountsKey = ['provider-accounts'] as const

function ProviderAccountPicker({
  accounts,
  selected,
  disabled,
  onChange,
}: {
  accounts: readonly ProviderAccount[]
  selected: string
  disabled: boolean
  onChange: (id: string) => void
}) {
  return (
    <Select
      aria-label="AI service"
      className="w-full sm:w-80"
      value={selected}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      <option value="">Choose a service</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
          {account.available ? (account.source ? ' (connected)' : '') : ' (unavailable)'}
        </option>
      ))}
    </Select>
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
    <div className="flex flex-wrap items-center gap-2">
      <p role={status.status === 'error' ? 'alert' : 'status'} className="text-sm empty:hidden">
        {status.message}
      </p>
      {provider.methods.map((method) => (
        <Button
          key={method.type}
          title={method.label}
          disabled={busy}
          onClick={() => start(method.type)}
        >
          {method.type === 'oauth' ? 'Sign in' : 'Use API key'}
        </Button>
      ))}
      {provider.stored ? (
        <Button disabled={busy} onClick={logout}>
          {provider.available ? 'Sign out' : 'Remove saved sign-in'}
        </Button>
      ) : null}
      {provider.available && provider.methods.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">
          Set up access through this service's environment variables or credential files on the
          server.
        </p>
      ) : null}
    </div>
  )
}

export function SettingsAiServices() {
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
    <>
      <SettingRow
        setting={{
          id: 'ai-services.select',
          category: 'general',
          title: 'AI services',
          description: 'Sign-ins are shared with Pi.',
          render: () => (
            <>
              {accounts.isPending ? (
                <p role="status" className="text-sm">
                  Loading services...
                </p>
              ) : null}
              {accounts.error ? (
                <div role="alert" className="text-sm">
                  <p>{accounts.error.message}</p>
                  <Button onClick={() => void accounts.refetch()}>Retry</Button>
                </div>
              ) : null}
              {accounts.data ? (
                <ProviderAccountPicker
                  accounts={accounts.data.accounts}
                  selected={selected}
                  disabled={running || busy}
                  onChange={(value) => {
                    setSelected(value)
                    setLogoutStatus({ status: 'idle', message: '' })
                  }}
                />
              ) : null}
            </>
          ),
        }}
      />
      {provider ? (
        running ? null : (
          <SettingRow
            setting={{
              id: 'ai-services.connection',
              category: 'general',
              title: provider.name,
              description: serviceConnectionStatus(provider),
              render: () => (
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
              ),
            }}
          />
        )
      ) : null}
      <ProviderLoginInteraction login={login} />
    </>
  )
}

function serviceConnectionStatus(service: ProviderAccount) {
  if (!service.available)
    return 'This service is no longer available. You can remove its saved sign-in.'
  return service.source ? `Connected using ${service.source}.` : 'Not connected.'
}

function ProviderLoginInteraction({ login }: { login: ReturnType<typeof useProviderLogin> }) {
  return (
    <>
      {login.error ? (
        <p role="alert" className="px-1 py-1.5 text-right text-sm">
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
              cancel={login.cancel}
            />
          ) : null}
          {login.session.prompt ? null : (
            <div className={settingRowClass}>
              <span />
              <Button disabled={login.busy} onClick={() => void login.cancel()}>
                Cancel sign-in
              </Button>
            </div>
          )}
        </>
      ) : null}
    </>
  )
}
