import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { Tooltip } from "../../../components/common/Tooltip";
import type { PiPackageCatalogItem } from "../../../desktop/types";
import { settingsListRowClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { formatDownloads, openExternalUrl } from "../utils";

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
  const externalUrl = item.repositoryUrl ?? item.homepageUrl ?? item.npmUrl;
  const installLabel = pendingInstall
    ? `Installing ${item.name}`
    : installed
      ? `${item.name} installed`
      : `Install ${item.name}`;

  return (
    <div
      className={cn(settingsListRowClass, "gap-2 py-2", selected && "bg-[rgba(255,255,255,0.04)]")}
    >
      <div className="min-w-0 grid gap-0.5">
        <div className="flex items-center gap-2">
          <Tooltip content={externalUrl} contentClassName="max-w-[420px]">
            <button
              type="button"
              className="group inline-flex min-w-0 items-center gap-0.5 p-0"
              onClick={() => void openExternalUrl(externalUrl)}
              aria-label={`Open ${item.name}`}
            >
              <span className="truncate text-[13px] text-[color:var(--text)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
                {item.name}
              </span>
              <ArrowUpRight
                size={12}
                className="shrink-0 text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
              />
            </button>
          </Tooltip>
          <span className="text-[11px] text-[color:var(--muted)]">
            {formatDownloads(item.monthlyDownloads)}
          </span>
          <span className="text-[11px] text-[color:var(--muted)]">v{item.version}</span>
          {installed ? (
            <span className="text-[11px] text-[color:var(--muted)]">Installed</span>
          ) : null}
        </div>
        <div className="truncate text-[12px] text-[color:var(--muted)]">
          {item.description || item.source}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)]">
          {pendingInstall ? (
            <Sparkles size={14} />
          ) : installed ? (
            <Check size={14} strokeWidth={2.4} />
          ) : (
            <Tooltip content={installLabel}>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
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
