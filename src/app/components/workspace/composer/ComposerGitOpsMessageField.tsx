import type { KeyboardEventHandler, ReactNode } from "react";
import { ComposerTextField } from "./ComposerTextField";

type ComposerGitOpsMessageFieldProps = {
  actionErrorMessage: string | null;
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
      statusMessage={errorMessage && value.length > 0 ? errorMessage : null}
      reservedLineCount={1}
      onHeightChange={onLayoutChange}
    />
  );

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
    </div>
  );
}
