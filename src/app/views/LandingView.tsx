import { ChevronDown } from "lucide-react";
import { FeatureStatusBadge } from "../components/common/FeatureStatusBadge";
import { PiLogoMark } from "../components/common/PiLogoMark";
import { TextButton } from "../components/common/TextButton";
import type { DesktopAction } from "../desktop/actions";
import { getFeatureStatusButtonClass } from "../features/feature-status";

type LandingViewProps = {
  projectName: string;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function LandingView({ projectName, onAction }: LandingViewProps) {
  return (
    <section className="grid w-full max-w-[700px] place-items-center gap-1 text-center text-[color:var(--muted)]">
      <div className="grid h-16 w-16 place-items-center rounded-full text-[color:var(--accent)]">
        <PiLogoMark className="h-[42px] w-[42px]" />
      </div>
      <h1 className="m-0 text-[clamp(36px,6vw,54px)] font-medium tracking-[-0.04em] text-[color:var(--accent)]">
        Let’s build
      </h1>
      <TextButton
        className={`inline-flex items-center gap-2 px-2 py-1 text-[18px] text-[color:var(--muted)] hover:text-[color:var(--text)] ${getFeatureStatusButtonClass("feature:landing.project-switcher")}`}
        onClick={() => onAction("landing.project-switcher")}
      >
        {projectName}
        <FeatureStatusBadge statusId="feature:landing.project-switcher" />
        <ChevronDown size={16} />
      </TextButton>
    </section>
  );
}
