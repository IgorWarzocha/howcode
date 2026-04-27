import { useRef, useState } from "react";
import type { ComposerContextUsage } from "../../../desktop/types";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import { ghostButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";

type ComposerContextMeterProps = {
  contextUsage: ComposerContextUsage | null;
  isCompacting: boolean;
  compactDisabled: boolean;
  onCompact: () => void;
};

const tokenFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const numberFormatter = new Intl.NumberFormat("en");

function formatTokens(value: number | null | undefined, options: { compact?: boolean } = {}) {
  if (value === null || value === undefined) {
    return "Unknown";
  }

  return options.compact ? tokenFormatter.format(value) : numberFormatter.format(value);
}

function getMeterTone(percent: number | null | undefined) {
  if (percent === null || percent === undefined) {
    return "rgba(146,153,184,0.64)";
  }

  if (percent > 90) {
    return "#ff9f9f";
  }

  if (percent > 70) {
    return "#f2c27f";
  }

  return "#9bb7ff";
}

export function ComposerContextMeter({
  contextUsage,
  isCompacting,
  compactDisabled,
  onCompact,
}: ComposerContextMeterProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const percent = contextUsage?.percent ?? null;
  const tokens = contextUsage?.tokens ?? null;
  const contextWindow = contextUsage?.contextWindow ?? null;
  const availableTokens =
    tokens !== null && contextWindow !== null ? Math.max(0, contextWindow - tokens) : null;
  const meterPercent = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const tone = getMeterTone(percent);
  const open = hovered || pinned;
  const label = isCompacting
    ? "Compacting context"
    : percent === null || percent === undefined
      ? "Context unknown"
      : `${percent.toFixed(0)}% context`;

  useDismissibleLayer({
    open: pinned,
    onDismiss: () => setPinned(false),
    refs: [buttonRef, popoverRef],
  });

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        className="relative inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
        onClick={() => setPinned((current) => !current)}
        aria-label={label}
        aria-expanded={open}
      >
        <span
          className={cn("absolute inset-[7px] rounded-full", isCompacting && "animate-pulse")}
          style={{
            background: `conic-gradient(${tone} ${meterPercent * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
          }}
        />
        <span className="absolute inset-[11px] rounded-full bg-[#272a39]" />
      </button>

      {open ? (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-0 z-[130] grid w-56 gap-2 rounded-xl border border-[rgba(169,178,215,0.18)] bg-[#2d3040] p-3 text-[12px] text-[color:var(--muted)] shadow-[0_18px_44px_rgba(0,0,0,0.4)]"
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="grid gap-1">
            <div className="flex justify-between gap-3">
              <span>Used</span>
              <span className="font-mono text-[color:var(--text)]">{formatTokens(tokens)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Available</span>
              <span className="font-mono text-[color:var(--text)]">
                {formatTokens(availableTokens)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Window</span>
              <span className="font-mono text-[color:var(--text)]">
                {formatTokens(contextWindow)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Usage</span>
              <span className="font-mono text-[color:var(--text)]">
                {percent === null || percent === undefined ? "Unknown" : `${percent.toFixed(1)}%`}
              </span>
            </div>
          </div>
          {tokens === null ? (
            <div className="text-[11px] text-[color:var(--muted-2)]">
              Usage is unknown until the next response updates token stats.
            </div>
          ) : null}
          {isCompacting ? (
            <div className="rounded-lg border border-[rgba(155,183,255,0.2)] bg-[rgba(155,183,255,0.08)] px-2 py-1.5 text-[11px] text-[#cbd7ff]">
              Compacting session context…
            </div>
          ) : null}
          <button
            type="button"
            className={cn(
              ghostButtonClass,
              "mt-1 justify-center border-[color:var(--border)] text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-45",
            )}
            disabled={compactDisabled}
            onClick={() => {
              if (compactDisabled) {
                return;
              }

              setHovered(false);
              setPinned(false);
              onCompact();
            }}
          >
            Compact
          </button>
        </div>
      ) : null}
    </div>
  );
}
