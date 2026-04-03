type SplitButtonProps = {
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
};

export function SplitButton({
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: SplitButtonProps) {
  return (
    <div className="flex">
      <button
        type="button"
        className="min-h-8 rounded-l-xl border border-r-0 border-[color:var(--border-strong)] bg-[rgba(39,43,57,0.9)] px-3"
        aria-label={primaryLabel}
        onClick={onPrimary}
      >
        {primaryLabel}
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-r-xl border border-[color:var(--border-strong)] bg-[rgba(39,43,57,0.9)]"
        aria-label={secondaryLabel}
        onClick={onSecondary}
      >
        <span aria-hidden>▾</span>
      </button>
    </div>
  );
}
