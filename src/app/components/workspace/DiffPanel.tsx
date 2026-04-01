import type { DesktopAction } from "../../desktop/actions";
import { SurfacePanel } from "../common/SurfacePanel";
import { TextButton } from "../common/TextButton";

type DiffPanelProps = {
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function DiffPanel({ onAction }: DiffPanelProps) {
  return (
    <SurfacePanel className="grid gap-3 self-start p-4 xl:w-[300px]">
      <div className="flex items-center justify-between">
        <span>Diff</span>
        <TextButton onClick={() => onAction("diff.review")}>Review</TextButton>
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
