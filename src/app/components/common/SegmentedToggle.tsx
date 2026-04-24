import { useId } from "react";
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
  ariaLabel?: string;
  size?: "default" | "compact";
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = "default",
}: SegmentedToggleProps<T>) {
  const compact = size === "compact";
  const groupName = useId();

  return (
    <fieldset className={cn(segmentedControlClass, "m-0 min-w-0", compact && "p-[3px]")}>
      {ariaLabel ? <legend className="sr-only">{ariaLabel}</legend> : null}
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            segmentedControlOptionClass,
            "cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--accent)]",
            compact && "px-2.5 py-1 text-[11.5px] leading-4",
            value === option.value
              ? "bg-[rgba(255,255,255,0.18)] font-medium text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]"
              : "text-[color:var(--muted)] hover:text-[color:var(--text)]",
            option.disabled &&
              "cursor-not-allowed opacity-45 hover:text-[color:var(--muted)] has-[:focus-visible]:outline-0",
          )}
        >
          <input
            type="radio"
            name={groupName}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            className="sr-only"
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
