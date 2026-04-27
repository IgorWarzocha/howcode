import { Check, ChevronDown } from "lucide-react";
import type { DictationModelId } from "../../desktop/types";
import { popoverPanelClass, composerTextActionButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import type { InlineSelectOption, SettingDescriptor } from "./settingsTypes";

export function ToggleBox({
  checked,
  label,
  onClick,
}: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[color:var(--border)] bg-transparent text-[color:var(--text)] transition-colors active:scale-[0.96] hover:border-[color:var(--border-strong)]"
      onClick={onClick}
      aria-label={label}
      aria-pressed={checked}
      data-tooltip={label}
    >
      {checked ? <Check size={13} /> : null}
    </button>
  );
}

export function SettingRow({ setting }: { setting: SettingDescriptor }) {
  return (
    <div
      className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-start gap-5 border-b border-[rgba(169,178,215,0.09)] px-1 py-1.5 last:border-b-0"
      data-setting-id={setting.id}
    >
      <div className="min-w-0 truncate pt-2 text-[13px] text-[color:var(--text)]">
        {setting.title}
      </div>
      <div className="min-w-0 justify-self-end">{setting.render()}</div>
    </div>
  );
}

export function InlineSelect({
  id,
  value,
  options,
  open,
  className,
  onChange,
  onOpenChange,
}: {
  id: string;
  value: string;
  options: InlineSelectOption[];
  open: boolean;
  className?: string;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null;
  const compactOptionClass =
    "flex min-h-0 w-full items-center rounded-md border border-transparent px-2 py-1 text-left text-[11.5px] leading-4 text-[color:var(--text)] transition-colors hover:bg-[rgba(255,255,255,0.045)]";

  return (
    <span className={cn("relative block", className)} data-inline-select-root>
      <button
        type="button"
        className={cn(
          composerTextActionButtonClass,
          "grid h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-start gap-2 rounded-lg px-2.5 pr-8 text-left font-normal",
          open && "border-[rgba(169,178,215,0.22)] bg-[rgba(255,255,255,0.1)]",
        )}
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
      >
        <span className="min-w-0 truncate text-[13px] text-[color:var(--text)]">
          {selectedOption?.label ?? "Select"}
        </span>
      </button>
      <ChevronDown
        size={14}
        className={cn(
          "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[color:var(--muted)] transition-transform",
          open && "rotate-180",
        )}
      />
      {open ? (
        <div
          id={`${id}-menu`}
          role="menu"
          className={cn(
            popoverPanelClass,
            "absolute top-[calc(100%+6px)] left-0 z-[60] grid max-h-64 w-full min-w-44 overflow-y-auto rounded-xl border border-[color:var(--border-strong)] bg-[rgba(45,48,64,0.98)] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.28)]",
          )}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className={cn(
                compactOptionClass,
                option.value === value && "bg-[rgba(255,255,255,0.06)]",
              )}
              onClick={() => {
                onChange(option.value);
                onOpenChange(false);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate leading-4">{option.label}</span>
                {option.description ? (
                  <span className="block truncate text-[10px] leading-3 text-[color:var(--muted)]">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

export function normalizeManagedDictationModelId(
  modelId: string | null | undefined,
): DictationModelId | null {
  return modelId === "tiny.en" || modelId === "base.en" || modelId === "small.en" ? modelId : null;
}
