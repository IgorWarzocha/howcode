import type { KeyboardEventHandler, ReactNode, RefObject } from 'react'
import { ComposerTextField } from './composer-text-field'

type ComposerGitOpsMessageFieldProps = {
  actionErrorMessage: string | null
  actionStatusMessage?: string | null
  actionStatusTone?: 'success' | 'error'
  diffCommentError: string | null
  hasDiffComments: boolean
  onChange: (message: string) => void
  onFocus: () => void
  onBlur: () => void
  onLayoutChange: () => void
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>
  onInput?: () => void
  trailingAccessory?: ReactNode
  value: string
  commitFocused: boolean
  isGitRepo: boolean
  hoverToFocus: boolean
  hoverToBlur: boolean
  hoverBoundaryRef?: RefObject<HTMLElement | null>
}

function getGitOpsMessagePlaceholder({
  commitFocused,
  errorMessage,
  hasDiffComments,
  isGitRepo,
}: {
  commitFocused: boolean
  errorMessage: string | null
  hasDiffComments: boolean
  isGitRepo: boolean
}) {
  if (errorMessage) return errorMessage
  if (commitFocused) return ''
  if (hasDiffComments) return 'Address & fix these comments: '
  return isGitRepo ? 'Leave blank to autogenerate a commit message' : 'Not a git repository'
}

function getStatusMessageClass(statusTone: 'success' | 'error', compact = false) {
  const spacing = compact ? 'mt-1 truncate ' : ''
  return statusTone === 'error'
    ? `${spacing}text-[12px] leading-4 text-[color:var(--danger)]`
    : `${spacing}text-[12px] leading-4 text-[color:var(--green)]`
}

export function ComposerGitOpsMessageField({
  actionErrorMessage,
  actionStatusMessage = null,
  actionStatusTone = 'success',
  diffCommentError,
  hasDiffComments,
  onBlur,
  onChange,
  onFocus,
  onInput,
  onKeyDown,
  onLayoutChange,
  trailingAccessory,
  value,
  commitFocused,
  isGitRepo,
  hoverToFocus,
  hoverToBlur,
  hoverBoundaryRef,
}: ComposerGitOpsMessageFieldProps) {
  const errorMessage = actionErrorMessage ?? diffCommentError
  const statusMessage = errorMessage ?? actionStatusMessage
  const statusTone = errorMessage ? 'error' : actionStatusTone
  const placeholder = getGitOpsMessagePlaceholder({
    commitFocused,
    errorMessage,
    hasDiffComments,
    isGitRepo,
  })

  const field = (
    <ComposerTextField
      value={value}
      onChange={onChange}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      ariaLabel={hasDiffComments ? 'Comment instructions' : 'Commit message'}
      placeholder={placeholder}
      placeholderTone={errorMessage ? 'error' : 'muted'}
      statusMessage={statusMessage && value.length > 0 ? statusMessage : null}
      statusTone={statusTone}
      reservedLineCount={1}
      onHeightChange={onLayoutChange}
      hoverToFocus={hoverToFocus}
      hoverToBlur={hoverToBlur}
      hoverBoundaryRef={hoverBoundaryRef}
    />
  )

  const visibleStatusMessage =
    actionStatusMessage && !errorMessage && value.length === 0 ? actionStatusMessage : null

  const liveError = errorMessage ? (
    <span className="sr-only" aria-live="polite">
      {errorMessage}
    </span>
  ) : null

  if (hasDiffComments) {
    return (
      <div className="flex items-end justify-between gap-2 px-4 pb-3">
        <div className="min-w-0 flex-1">{field}</div>
        <div className="inline-flex items-center gap-2">{trailingAccessory}</div>
        {visibleStatusMessage ? (
          <div className={getStatusMessageClass(statusTone)}>{visibleStatusMessage}</div>
        ) : null}
        {liveError}
      </div>
    )
  }

  return (
    <div className="grid content-end px-4 py-3">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">{field}</div>
        <div className="inline-flex items-center gap-2">{trailingAccessory}</div>
        {liveError}
      </div>
      {visibleStatusMessage ? (
        <div className={getStatusMessageClass(statusTone, true)}>{visibleStatusMessage}</div>
      ) : null}
    </div>
  )
}
