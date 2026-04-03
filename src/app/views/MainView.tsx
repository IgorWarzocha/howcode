import { automationCards, debugCards, pluginCards } from "../data/mock-data";
import type { DesktopAction } from "../desktop/actions";
import type { ThreadData } from "../desktop/types";
import type { View } from "../types";
import { CardGridView } from "./CardGridView";
import { LandingView } from "./LandingView";
import { ThreadView } from "./ThreadView";

type MainViewProps = {
  activeView: View;
  currentProjectName: string;
  threadData: ThreadData | null;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onLoadEarlierMessages: () => void;
};

export function MainView({
  activeView,
  currentProjectName,
  threadData,
  onAction,
  onOpenTurnDiff,
  onLoadEarlierMessages,
}: MainViewProps) {
  if (activeView === "thread") {
    return (
      <ThreadView
        key={threadData?.sessionPath ?? "new-thread"}
        messages={threadData?.messages ?? []}
        previousMessageCount={threadData?.previousMessageCount ?? 0}
        isStreaming={threadData?.isStreaming ?? false}
        turnDiffSummaries={threadData?.turnDiffSummaries ?? []}
        onOpenTurnDiff={onOpenTurnDiff}
        onLoadEarlierMessages={onLoadEarlierMessages}
      />
    );
  }

  if (activeView === "plugins") {
    return (
      <div className="grid min-h-full content-start px-2 pt-8">
        <CardGridView
          eyebrow="Plugins"
          title="Pi plugin surface"
          description="Visual parity first: every major Codex-style action is represented as a desktop stub."
          cards={pluginCards}
          action="plugins.open-card"
          statusId="feature:views.plugins"
          onAction={onAction}
        />
      </div>
    );
  }

  if (activeView === "automations") {
    return (
      <div className="grid min-h-full content-start px-2 pt-8">
        <CardGridView
          eyebrow="Automations"
          title="Run-aware project workflows"
          description="These tiles are placeholder flows for eventual Pi feature parity."
          cards={automationCards}
          action="automations.open-card"
          statusId="feature:views.automations"
          onAction={onAction}
        />
      </div>
    );
  }

  if (activeView === "debug") {
    return (
      <div className="grid min-h-full content-start px-2 pt-8">
        <CardGridView
          eyebrow="Debug"
          title="Desktop inspection scaffolding"
          description="Everything here is wired as mock UI so we can swap in Pi SDK data later."
          cards={debugCards}
          action="debug.open-card"
          statusId="feature:views.debug"
          onAction={onAction}
        />
      </div>
    );
  }

  return (
    <div className="grid h-full place-items-center px-4 pb-6">
      <LandingView projectName={currentProjectName} onAction={onAction} />
    </div>
  );
}
