import { Button, Input, Select } from '@howaboua/howcode-sdk/ui/controls'
import { useId, useState } from 'react'
import { getSafeExternalUrl } from '../../../../shared/external-url'
import type { ProviderAuthPrompt, ProviderAuthSession } from '../../../../shared/provider-auth'
import { settingRowClass } from './settingsClasses'

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
    <>
      {session.notices.map((notice) => (
        <div key={JSON.stringify(notice)} className={`${settingRowClass} text-sm`}>
          {notice.type === 'auth_url' ? (
            <>
              <p>{notice.instructions || 'Sign in on the service’s website.'}</p>
              <AuthLink url={notice.url}>Open sign-in page</AuthLink>
            </>
          ) : null}
          {notice.type === 'device_code' ? (
            <>
              <p>
                Enter code: <strong className="select-all">{notice.userCode}</strong>
              </p>
              <AuthLink url={notice.verificationUri}>Open sign-in page</AuthLink>
            </>
          ) : null}
          {notice.type === 'info' ? (
            <>
              <p>{notice.message}</p>
              <div className="grid gap-1 sm:justify-self-end">
                {notice.links?.map((link) => (
                  <p key={link.url}>
                    <AuthLink url={link.url}>{link.label ?? link.url}</AuthLink>
                  </p>
                ))}
              </div>
            </>
          ) : null}
          {notice.type === 'progress' ? <p>{notice.message}</p> : null}
        </div>
      ))}
      {session.message || !session.prompt ? (
        <p role="status" className="px-1 py-1.5 text-right text-sm">
          {session.message || 'Waiting for sign-in…'}
        </p>
      ) : null}
    </>
  )
}

export function ProviderLoginPrompt({
  prompt,
  busy,
  answer,
  cancel,
}: {
  prompt: ProviderAuthPrompt
  busy: boolean
  answer: (value: string) => Promise<boolean>
  cancel: () => Promise<void>
}) {
  const id = useId()
  const [value, setValue] = useState('')
  const submit = async () => {
    if (await answer(value)) setValue('')
  }
  return (
    <form
      className="grid min-w-0"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className={settingRowClass}>
        <label htmlFor={id} className="text-sm">
          {prompt.message}
        </label>
        {prompt.type === 'select' ? (
          <Select
            id={id}
            className="w-full sm:w-80"
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
            className="w-full sm:w-80"
            type={prompt.type === 'text' ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={value}
            placeholder={prompt.placeholder}
            onChange={(event) => setValue(event.target.value)}
            disabled={busy}
          />
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 px-1 py-1.5">
        <Button disabled={busy} onClick={() => void cancel()}>
          Cancel sign-in
        </Button>
        <Button type="submit" disabled={busy}>
          Continue
        </Button>
      </div>
    </form>
  )
}
