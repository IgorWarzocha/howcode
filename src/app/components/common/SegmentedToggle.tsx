import { segmentedControlClass, segmentedControlOptionClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type SegmentedToggleOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  options: readonly SegmentedToggleOption<T>[];
  onChange: (value: T) => void;
  size?: "default" | "compact";
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  size = "default",
}: SegmentedToggleProps<T>) {
  const compact = size === "compact";

  return (
    <div className={cn(segmentedControlClass, compact && "p-[3px]")}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            segmentedControlOptionClass,
            compact && "px-2.5 py-1 text-[11.5px] leading-4",
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
