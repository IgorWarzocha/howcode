import type { KeyboardEventHandler, ReactNode } from "react";
import { ComposerTextField } from "./ComposerTextField";

type ComposerGitOpsMessageFieldProps = {
  actionErrorMessage: string | null;
  actionStatusMessage?: string | null;
  actionStatusTone?: "success" | "error";
  diffCommentError: string | null;
  hasDiffComments: boolean;
  onChange: (message: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onLayoutChange: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  onInput?: () => void;
  trailingAccessory?: ReactNode;
  value: string;
  commitFocused: boolean;
  isGitRepo: boolean;
};

export function ComposerGitOpsMessageField({
  actionErrorMessage,
  actionStatusMessage = null,
  actionStatusTone = "success",
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
}: ComposerGitOpsMessageFieldProps) {
  const errorMessage = actionErrorMessage ?? diffCommentError;
  const statusMessage = errorMessage ?? actionStatusMessage;
  const statusTone = errorMessage ? "error" : actionStatusTone;
  const placeholder = hasDiffComments
    ? errorMessage
      ? errorMessage
      : commitFocused
        ? ""
        : "Address & fix these comments: "
    : errorMessage
      ? errorMessage
      : commitFocused
        ? ""
        : isGitRepo
          ? "Leave blank to autogenerate a commit message"
          : "Not a git repository";

  const field = (
    <ComposerTextField
      value={value}
      onChange={onChange}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      ariaLabel={hasDiffComments ? "Comment instructions" : "Commit message"}
      placeholder={placeholder}
      placeholderTone={errorMessage ? "error" : "muted"}
      statusMessage={statusMessage && value.length > 0 ? statusMessage : null}
      statusTone={statusTone}
      reservedLineCount={1}
      onHeightChange={onLayoutChange}
    />
  );

  const visibleStatusMessage =
    actionStatusMessage && !errorMessage && value.length === 0 ? actionStatusMessage : null;

  const liveError = errorMessage ? (
    <span className="sr-only" aria-live="polite">
      {errorMessage}
    </span>
  ) : null;

  if (hasDiffComments) {
    return (
      <div className="flex items-end justify-between gap-2 px-4 pb-3">
        <div className="min-w-0 flex-1">{field}</div>
        <div className="inline-flex items-center gap-2">{trailingAccessory}</div>
        {visibleStatusMessage ? (
          <div
            className={
              statusTone === "error"
                ? "text-[12px] leading-4 text-[#f2a7a7]"
                : "text-[12px] leading-4 text-[color:var(--green)]"
            }
          >
            {visibleStatusMessage}
          </div>
        ) : null}
        {liveError}
      </div>
    );
  }

  return (
    <div className="grid content-end px-4 py-3">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">{field}</div>
        <div className="inline-flex items-center gap-2">{trailingAccessory}</div>
        {liveError}
      </div>
      {visibleStatusMessage ? (
        <div
          className={
            statusTone === "error"
              ? "mt-1 truncate text-[12px] leading-4 text-[#f2a7a7]"
              : "mt-1 truncate text-[12px] leading-4 text-[color:var(--green)]"
          }
        >
          {visibleStatusMessage}
        </div>
      ) : null}
    </div>
  );
}
