import { automationCards, debugCards, pluginCards, threadMessages } from "../data/mock-data";
import type { DesktopAction } from "../desktop/actions";
import type { View } from "../types";
import { CardGridView } from "./CardGridView";
import { LandingView } from "./LandingView";
import { ThreadView } from "./ThreadView";

type MainViewProps = {
  activeView: View;
  currentProjectName: string;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function MainView({ activeView, currentProjectName, onAction }: MainViewProps) {
  if (activeView === "thread") {
    return <ThreadView messages={threadMessages} />;
  }

  if (activeView === "plugins") {
    return (
      <CardGridView
        eyebrow="Plugins"
        title="Pi plugin surface"
        description="Visual parity first: every major Codex-style action is represented as a desktop stub."
        cards={pluginCards}
        action="plugins.open-card"
        onAction={onAction}
      />
    );
  }

  if (activeView === "automations") {
    return (
      <CardGridView
        eyebrow="Automations"
        title="Run-aware project workflows"
        description="These tiles are placeholder flows for eventual Pi feature parity."
        cards={automationCards}
        action="automations.open-card"
        onAction={onAction}
      />
    );
  }

  if (activeView === "debug") {
    return (
      <CardGridView
        eyebrow="Debug"
        title="Desktop inspection scaffolding"
        description="Everything here is wired as mock UI so we can swap in Pi SDK data later."
        cards={debugCards}
        action="debug.open-card"
        onAction={onAction}
      />
    );
  }

  return <LandingView projectName={currentProjectName} onAction={onAction} />;
}
