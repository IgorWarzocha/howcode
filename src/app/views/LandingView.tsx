import { Bot, ChevronDown } from "lucide-react";
import { TextButton } from "../components/common/TextButton";
import type { DesktopAction } from "../desktop/actions";

type LandingViewProps = {
  projectName: string;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function LandingView({ projectName, onAction }: LandingViewProps) {
  return (
    <section className="grid w-full max-w-[700px] place-items-center gap-2 text-center text-[color:var(--muted)]">
      <div className="grid h-[72px] w-[72px] place-items-center rounded-full border border-[color:var(--border-strong)] bg-[rgba(183,186,245,0.06)] text-[color:var(--accent)] shadow-[0_0_0_10px_rgba(183,186,245,0.035)]">
        <Bot size={34} />
      </div>
      <h1 className="m-0 text-[clamp(36px,6vw,56px)] font-medium text-[color:var(--accent)]">
        Let’s build
      </h1>
      <p className="max-w-[560px] whitespace-normal text-sm text-[color:var(--muted)]">
        Shape the desktop shell first, then swap mock data for live Pi threads, tools, and runs.
      </p>
      <TextButton
        className="inline-flex items-center gap-2 px-3 py-2"
        onClick={() => onAction("landing.project-switcher")}
      >
        {projectName} <ChevronDown size={16} />
      </TextButton>
    </section>
  );
}
