import { cn } from "../../../utils/cn";

type PlainToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

export function PlainToggle({ checked, disabled = false, label, onClick }: PlainToggleProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 text-[12px] text-[color:var(--muted)] transition-colors",
        disabled ? "cursor-not-allowed opacity-45" : "hover:text-[color:var(--text)]",
      )}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-[color:var(--accent)]" : "bg-[rgba(255,255,255,0.14)]",
        )}
      >
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full bg-[#1a1c26] transition-transform",
            checked ? "translate-x-5" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}
