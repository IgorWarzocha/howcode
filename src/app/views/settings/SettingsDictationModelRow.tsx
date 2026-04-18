import { Check, Download, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { ActivitySpinner } from "../../components/common/ActivitySpinner";
import type { DictationModelId, DictationModelSummary } from "../../desktop/types";
import { settingsListRowClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import type { DictationPendingAction } from "./useSettingsDictationController";

function ModelActionButton({
  disabled = false,
  primary = false,
  onClick,
  label,
  icon,
}: {
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#1a1c26]"
          : "border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] text-[color:var(--muted)] hover:text-[color:var(--text)]",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function SettingsDictationModelRow({
  activeModelId,
  model,
  pendingAction,
  anyPending,
  onDelete,
  onDownload,
  onUse,
}: {
  activeModelId: DictationModelId | null;
  model: DictationModelSummary;
  pendingAction: DictationPendingAction["kind"] | null;
  anyPending: boolean;
  onDelete: () => void;
  onDownload: () => void;
  onUse: () => void;
}) {
  const isSwitchTarget = activeModelId !== null && activeModelId !== model.id;
  const downloadLabel = isSwitchTarget ? "Download & use" : "Download";

  return (
    <div className={settingsListRowClass}>
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2 text-[13px] text-[color:var(--text)]">
          <span>{model.name}</span>
          <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10.5px] text-[color:var(--muted)]">
            {model.downloadSizeLabel}
          </span>
          {model.selected ? (
            <span className="rounded-full border border-[rgba(183,186,245,0.24)] bg-[rgba(183,186,245,0.08)] px-2 py-0.5 text-[10.5px] text-[color:var(--text)]">
              Selected
            </span>
          ) : null}
        </div>
        <div className="text-[12px] text-[color:var(--muted)]">{model.description}</div>
      </div>

      <div className="flex items-center gap-2">
        {model.installed ? (
          <>
            {model.selected ? (
              <div className="inline-flex min-h-7 items-center gap-1 rounded-full border border-[rgba(183,186,245,0.24)] bg-[rgba(183,186,245,0.08)] px-2.5 text-[11px] text-[color:var(--text)]">
                <Check size={11} />
                <span>In use</span>
              </div>
            ) : (
              <ModelActionButton
                disabled={anyPending}
                label={pendingAction === "switch" ? "Switching…" : "Use"}
                icon={
                  pendingAction === "switch" ? (
                    <ActivitySpinner className="h-3 w-3 text-current" />
                  ) : (
                    <Check size={11} />
                  )
                }
                onClick={onUse}
              />
            )}

            {model.managed ? (
              <ModelActionButton
                disabled={anyPending}
                label={pendingAction === "delete" ? "Deleting…" : "Delete"}
                icon={
                  pendingAction === "delete" ? (
                    <ActivitySpinner className="h-3 w-3 text-current" />
                  ) : (
                    <Trash2 size={11} />
                  )
                }
                onClick={onDelete}
              />
            ) : null}
          </>
        ) : (
          <ModelActionButton
            primary
            disabled={anyPending}
            label={pendingAction === "download" ? "Downloading…" : downloadLabel}
            icon={
              pendingAction === "download" ? (
                <ActivitySpinner className="h-3 w-3 text-current" />
              ) : (
                <Download size={11} />
              )
            }
            onClick={onDownload}
          />
        )}
      </div>
    </div>
  );
}
