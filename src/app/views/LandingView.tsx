import { ChevronDown, Cloud } from "lucide-react";
import { TextButton } from "../components/common/TextButton";
import type { DesktopAction } from "../desktop/actions";

type LandingViewProps = {
  projectName: string;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function LandingView({ projectName, onAction }: LandingViewProps) {
  return (
    <section className="grid w-full max-w-[700px] place-items-center gap-1 text-center text-[color:var(--muted)]">
      <div className="grid h-16 w-16 place-items-center rounded-full text-[color:var(--accent)]">
        <Cloud size={42} strokeWidth={1.75} />
      </div>
      <h1 className="m-0 text-[clamp(36px,6vw,54px)] font-medium tracking-[-0.04em] text-[color:var(--accent)]">
        Let’s build
      </h1>
      <TextButton
        className="inline-flex items-center gap-1 px-2 py-1 text-[18px] text-[color:var(--muted)] hover:text-[color:var(--text)]"
        onClick={() => onAction("landing.project-switcher")}
      >
        {projectName} <ChevronDown size={16} />
      </TextButton>
    </section>
  );
}
