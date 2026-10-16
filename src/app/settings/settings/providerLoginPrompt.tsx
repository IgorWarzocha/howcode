import { Button, Input, Select } from '@howaboua/howcode-sdk/ui/controls'
import { useId, useState } from 'react'
import { getSafeExternalUrl } from '../../../../shared/external-url'
import type { ProviderAuthPrompt, ProviderAuthSession } from '../../../../shared/provider-auth'

function AuthLink({ url, children }: { url: string; children: React.ReactNode }) {
  const safeUrl = getSafeExternalUrl(url)
  return safeUrl ? (
    <a className="break-all underline" href={safeUrl} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <span>Unsupported sign-in URL.</span>
  )
}

export function ProviderLoginNotices({ session }: { session: ProviderAuthSession }) {
  return (
    <div className="grid gap-2 text-sm">
      {session.notices.map((notice) => (
        <div key={JSON.stringify(notice)}>
          {notice.type === 'auth_url' ? (
            <>
              <AuthLink url={notice.url}>Open sign-in page</AuthLink>
              {notice.instructions ? <p>{notice.instructions}</p> : null}
            </>
          ) : null}
          {notice.type === 'device_code' ? (
            <>
              <AuthLink url={notice.verificationUri}>Open sign-in page</AuthLink>
              <p>
                Enter code: <strong className="select-all">{notice.userCode}</strong>
              </p>
            </>
          ) : null}
          {notice.type === 'info' ? (
            <>
              <p>{notice.message}</p>
              {notice.links?.map((link) => (
                <p key={link.url}>
                  <AuthLink url={link.url}>{link.label ?? link.url}</AuthLink>
                </p>
              ))}
            </>
          ) : null}
          {notice.type === 'progress' ? <p>{notice.message}</p> : null}
        </div>
      ))}
      <p role="status">{session.message || 'Waiting for sign-in…'}</p>
    </div>
  )
}

export function ProviderLoginPrompt({
  prompt,
  busy,
  answer,
}: {
  prompt: ProviderAuthPrompt
  busy: boolean
  answer: (value: string) => Promise<boolean>
}) {
  const id = useId()
  const [value, setValue] = useState('')
  const submit = async () => {
    if (await answer(value)) setValue('')
  }
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <label htmlFor={id} className="text-sm">
        {prompt.message}
      </label>
      {prompt.type === 'select' ? (
        <Select
          id={id}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={busy}
          required
        >
          <option value="" disabled>
            Choose an option
          </option>
          {prompt.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
              {option.description ? ` — ${option.description}` : ''}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id={id}
          type={prompt.type === 'text' ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={prompt.placeholder}
          onChange={(event) => setValue(event.target.value)}
          disabled={busy}
        />
      )}
      {prompt.type === 'manual_code' ? (
        <p className="text-xs text-[color:var(--muted)]">
          If the browser redirects to an unreachable localhost page, paste its full URL here.
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        Continue
      </Button>
    </form>
  )
}
