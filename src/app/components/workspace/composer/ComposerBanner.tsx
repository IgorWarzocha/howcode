import { Globe, X } from "lucide-react";
import type { DesktopAction } from "../../../desktop/actions";
import type { DesktopActionResult } from "../../../desktop/types";
import { getFeatureStatusButtonClass } from "../../../features/feature-status";
import { FeatureStatusBadge } from "../../common/FeatureStatusBadge";
import { IconButton } from "../../common/IconButton";
import { PrimaryButton } from "../../common/PrimaryButton";
import { SurfacePanel } from "../../common/SurfacePanel";

type ComposerBannerProps = {
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
};

export function ComposerBanner({ onAction }: ComposerBannerProps) {
  return (
    <SurfacePanel className="flex items-center justify-between gap-4 px-5 py-4 max-md:flex-wrap">
      <div className="flex items-center gap-4">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)]">
          <Globe size={16} />
        </div>
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-[15px] text-[color:var(--text)]">
            Let Pi work while you’re away
            <FeatureStatusBadge statusId="feature:composer.remote-connections" />
          </div>
          <div className="text-[color:var(--muted)]">
            Run your threads on a remote machine and pick back up when you return.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 max-md:flex-wrap">
        <PrimaryButton
          className={getFeatureStatusButtonClass("feature:composer.connections.add")}
          onClick={() => onAction("connections.add")}
        >
          Add Connections
          <FeatureStatusBadge
            statusId="feature:composer.connections.add"
            className="ml-2 align-middle"
          />
        </PrimaryButton>
        <IconButton
          label="Dismiss remote connections banner"
          onClick={() => onAction("connections.dismiss-banner")}
          icon={<X size={16} />}
          className={getFeatureStatusButtonClass("feature:composer.connections.dismiss")}
        />
      </div>
    </SurfacePanel>
  );
}
