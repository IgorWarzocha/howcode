import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { Tooltip } from "../../../components/common/Tooltip";
import type { PiPackageCatalogItem } from "../../../desktop/types";
import { compactRoundIconButtonClass, settingsCompactListRowClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { formatDownloads, openExternalUrl, pickSafeExternalUrl } from "../utils";

type CatalogItemRowProps = {
  item: PiPackageCatalogItem;
  selected: boolean;
  installed: boolean;
  pendingInstall: boolean;
  onToggleSelected: (source: string) => void;
};

export function CatalogItemRow({
  item,
  selected,
  installed,
  pendingInstall,
  onToggleSelected,
}: CatalogItemRowProps) {
  const externalUrl = pickSafeExternalUrl([item.repositoryUrl, item.homepageUrl, item.npmUrl]);
  const installLabel = pendingInstall
    ? `Installing ${item.name}`
    : installed
      ? `${item.name} installed`
      : `Install ${item.name}`;

  return (
    <div className={cn(settingsCompactListRowClass, selected && "bg-[rgba(255,255,255,0.04)]")}>
      <div className="min-w-0 grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-baseline gap-1.5 overflow-hidden">
        <div className="min-w-0">
          {externalUrl ? (
            <Tooltip content={externalUrl} contentClassName="max-w-[420px]">
              <button
                type="button"
                className="group inline-flex min-w-0 shrink-0 items-center gap-0.5 p-0"
                onClick={() => void openExternalUrl(externalUrl)}
                aria-label={`Open ${item.name}`}
              >
                <span className="truncate text-[13px] leading-4 text-[color:var(--text)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
                  {item.name}
                </span>
                <ArrowUpRight
                  size={12}
                  className="shrink-0 text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
                />
              </button>
            </Tooltip>
          ) : (
            <span className="truncate text-[13px] leading-4 text-[color:var(--text)]">
              {item.name}
            </span>
          )}
        </div>
        <div className="min-w-0 truncate text-[12px] leading-4 text-[color:var(--muted)]">
          {item.description || item.source}
        </div>
        <span className="shrink-0 whitespace-nowrap text-[11px] leading-4 text-[color:var(--muted)]">
          {formatDownloads(item.monthlyDownloads)}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[11px] leading-4 text-[color:var(--muted)]">
          v{item.version}
        </span>
        {installed ? (
          <span className="shrink-0 whitespace-nowrap text-[11px] leading-4 text-[color:var(--muted)]">
            Installed
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--muted)]">
          {pendingInstall ? (
            <Sparkles size={14} />
          ) : installed ? (
            <Check size={14} strokeWidth={2.4} />
          ) : (
            <Tooltip content={installLabel}>
              <button
                type="button"
                className={compactRoundIconButtonClass}
                onClick={() => onToggleSelected(item.source)}
                aria-pressed={selected}
                aria-label={installLabel}
              >
                <span
                  className={cn(
                    "inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-[color:var(--muted-2)] bg-transparent transition-colors",
                    selected && "border-[rgba(183,186,245,0.42)] text-[color:var(--text)]",
                  )}
                >
                  {selected ? <Check size={11} strokeWidth={2.6} /> : null}
                </span>
              </button>
            </Tooltip>
          )}
        </span>
      </div>
    </div>
  );
}
