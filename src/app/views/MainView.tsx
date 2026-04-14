import { MarkdownContent } from "../components/common/MarkdownContent";
import { ViewHeader } from "../components/common/ViewHeader";
import { ViewShell } from "../components/common/ViewShell";
import type { View } from "../types";
import { getComingSoonViewContent } from "./coming-soon-roadmaps";

type MainViewProps = {
  activeView: View;
};

export function MainView({ activeView }: MainViewProps) {
  if (activeView !== "chat" && activeView !== "claw" && activeView !== "work") {
    return null;
  }

  const content = getComingSoonViewContent(activeView);

  return (
    <ViewShell maxWidthClassName="max-w-[760px]">
      <ViewHeader title={content.title} subtitle={content.subtitle} />

      <section className="grid gap-4 rounded-[18px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
        <MarkdownContent markdown={content.markdown} className="gap-3 text-[15px]" />
      </section>
    </ViewShell>
  );
}
