import { automationCards, debugCards, pluginCards } from "../data/mock-data";
import type { DesktopAction } from "../desktop/actions";
import type { View } from "../types";
import { CardGridView } from "./CardGridView";

type MainViewProps = {
  activeView: View;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function MainView({ activeView, onAction }: MainViewProps) {
  if (activeView === "chat") {
    return (
      <div className="grid min-h-full content-start px-2 pt-8">
        <CardGridView
          eyebrow="Chat"
          title="Chat surface"
          description="Visual parity first: every major Codex-style action is represented as a desktop stub."
          cards={pluginCards}
          action="plugins.open-card"
          statusId="feature:views.plugins"
          onAction={onAction}
        />
      </div>
    );
  }

  if (activeView === "claw") {
    return (
      <div className="grid min-h-full content-start px-2 pt-8">
        <CardGridView
          eyebrow="Claw"
          title="Claw surface"
          description="These tiles are placeholder flows for eventual Pi feature parity."
          cards={automationCards}
          action="automations.open-card"
          statusId="feature:views.automations"
          onAction={onAction}
        />
      </div>
    );
  }

  if (activeView === "work") {
    return (
      <div className="grid min-h-full content-start px-2 pt-8">
        <CardGridView
          eyebrow="Work"
          title="Work surface"
          description="Everything here is wired as mock UI so we can swap in Pi SDK data later."
          cards={debugCards}
          action="debug.open-card"
          statusId="feature:views.debug"
          onAction={onAction}
        />
      </div>
    );
  }

  return null;
}
