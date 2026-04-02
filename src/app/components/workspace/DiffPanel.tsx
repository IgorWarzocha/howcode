import type { DesktopAction } from "../../desktop/actions";
import { getFeatureStatusButtonClass } from "../../features/feature-status";
import { cn } from "../../utils/cn";
import { FeatureStatusBadge } from "../common/FeatureStatusBadge";
import { SurfacePanel } from "../common/SurfacePanel";
import { TextButton } from "../common/TextButton";

type DiffPanelProps = {
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function DiffPanel({ onAction }: DiffPanelProps) {
  return (
    <SurfacePanel
      className={cn(
        "grid gap-3 self-start p-4 xl:w-[300px]",
        getFeatureStatusButtonClass("feature:diff.panel"),
      )}
      data-feature-id="feature:diff.panel"
      data-feature-status="mock"
    >
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <span>Diff</span>
          <FeatureStatusBadge statusId="feature:diff.panel" />
        </div>
        <TextButton
          className={getFeatureStatusButtonClass("feature:diff.review")}
          onClick={() => onAction("diff.review")}
        >
          Review <FeatureStatusBadge statusId="feature:diff.review" className="ml-2" />
        </TextButton>
      </div>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(40,44,58,0.84)] p-3.5">
        <div className="mb-2.5 text-[13px] text-[color:var(--text)]">src/app/AppShell.tsx</div>
        <div className="mb-1.5 font-mono text-xs text-[color:var(--green)]">
          + Added modular desktop shell composition
        </div>
        <div className="mb-1.5 font-mono text-xs text-[color:var(--green)]">
          + Routed actions through typed renderer bridge
        </div>
        <div className="font-mono text-xs text-[color:var(--muted)]">
          Future: replace mock selectors with Pi SDK session state
        </div>
      </div>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(40,44,58,0.84)] p-3.5 opacity-80">
        <div className="mb-2.5 text-[13px] text-[color:var(--text)]">
          src/app/state/workspace.ts
        </div>
        <div className="font-mono text-xs text-[color:var(--green)]">
          + Added deterministic workspace reducer and selectors
        </div>
      </div>
    </SurfacePanel>
  );
}
