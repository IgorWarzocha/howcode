import { automationCards, debugCards, pluginCards } from "../data/mock-data";
import type { DesktopAction } from "../desktop/actions";
import type { AppSettings, ComposerModel, ThreadData } from "../desktop/types";
import type { View } from "../types";
import { CardGridView } from "./CardGridView";
import { LandingView } from "./LandingView";
import { SettingsView } from "./SettingsView";
import { ThreadView } from "./ThreadView";

type MainViewProps = {
  activeView: View;
  appSettings: AppSettings;
  availableModels: ComposerModel[];
  currentModel: ComposerModel | null;
  currentProjectName: string;
  threadData: ThreadData | null;
  composerLayoutVersion: number;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
  onOpenTurnDiff: (checkpointTurnCount: number, filePath?: string) => void;
  onLoadEarlierMessages: () => void;
};

export function MainView({
  activeView,
  appSettings,
  availableModels,
  currentModel,
  currentProjectName,
  threadData,
  composerLayoutVersion,
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
        composerLayoutVersion={composerLayoutVersion}
        onOpenTurnDiff={onOpenTurnDiff}
        onLoadEarlierMessages={onLoadEarlierMessages}
      />
    );
  }

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

  if (activeView === "settings") {
    return (
      <SettingsView
        appSettings={appSettings}
        availableModels={availableModels}
        currentModel={currentModel}
        onAction={onAction}
      />
    );
  }

  return (
    <div className="grid h-full place-items-center px-4 pb-6">
      <LandingView projectName={currentProjectName} onAction={onAction} />
    </div>
  );
}
