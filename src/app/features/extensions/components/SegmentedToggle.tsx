import { cn } from "../../../utils/cn";

type SegmentedToggleOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  options: readonly SegmentedToggleOption<T>[];
  onChange: (value: T) => void;
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
}: SegmentedToggleProps<T>) {
  return (
    <div className="inline-flex rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "rounded-full px-3 py-1 text-[12px] capitalize transition-colors",
            value === option.value
              ? "bg-[rgba(255,255,255,0.18)] font-medium text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]"
              : "text-[color:var(--muted)] hover:text-[color:var(--text)]",
          )}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          disabled={option.disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
