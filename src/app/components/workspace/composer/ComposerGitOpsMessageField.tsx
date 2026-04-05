import { GitCompareArrows } from "lucide-react";
import { cn } from "../../../utils/cn";
import { ComposerTextField } from "./ComposerTextField";

type ComposerGitOpsMessageFieldProps = {
  actionErrorMessage: string | null;
  diffCommentError: string | null;
  hasDiffComments: boolean;
  onChange: (message: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onLayoutChange: () => void;
  value: string;
  commitFocused: boolean;
};

export function ComposerGitOpsMessageField({
  actionErrorMessage,
  diffCommentError,
  hasDiffComments,
  onBlur,
  onChange,
  onFocus,
  onLayoutChange,
  value,
  commitFocused,
}: ComposerGitOpsMessageFieldProps) {
  const field = (
    <ComposerTextField
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      ariaLabel={hasDiffComments ? "Comment instructions" : "Commit message"}
      placeholder={
        hasDiffComments
          ? commitFocused
            ? ""
            : "Address & fix these comments: "
          : commitFocused
            ? ""
            : "Leave blank to autogenerate a commit message"
      }
      onHeightChange={onLayoutChange}
    />
  );

  const errorChrome = (
    <div
      className={cn(
        "inline-flex h-8 items-center justify-end rounded-full text-right text-[12px] leading-5",
        actionErrorMessage || diffCommentError ? "text-[#f2a7a7]" : "invisible w-8",
      )}
      aria-live={actionErrorMessage || diffCommentError ? "polite" : undefined}
      aria-hidden={actionErrorMessage || diffCommentError ? undefined : true}
    >
      {actionErrorMessage ?? diffCommentError ?? <GitCompareArrows size={16} />}
    </div>
  );

  if (hasDiffComments) {
    return (
      <div className="flex items-end justify-between gap-2 px-4 pb-3">
        <div className="min-w-0 flex-1">{field}</div>
        {errorChrome}
      </div>
    );
  }

  return (
    <div className="grid min-h-[148px] content-end px-4 pt-[52px] pb-3">
      <div className="flex min-h-[82px] items-end justify-between gap-2">
        <div className="min-w-0 flex-1">{field}</div>
        {errorChrome}
      </div>
    </div>
  );
}
