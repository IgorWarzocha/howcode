import type { View } from "../types";
import chatRoadmapMarkdown from "./roadmaps/chat.md?raw";
import clawRoadmapMarkdown from "./roadmaps/claw.md?raw";
import workRoadmapMarkdown from "./roadmaps/work.md?raw";

type ComingSoonView = Extract<View, "chat" | "claw" | "work">;

type ComingSoonViewContent = {
  title: string;
  subtitle: string;
  markdown: string;
};

const comingSoonViewContent: Record<ComingSoonView, ComingSoonViewContent> = {
  chat: {
    title: "Chat roadmap",
    subtitle: "Coming soon. This surface will focus on a lighter, chat-first Pi experience.",
    markdown: chatRoadmapMarkdown,
  },
  claw: {
    title: "Claw roadmap",
    subtitle: "Coming soon. This surface will grow into an OpenClaw-style personal assistant lane.",
    markdown: clawRoadmapMarkdown,
  },
  work: {
    title: "Work roadmap",
    subtitle: "Coming soon. This surface will become a Claude Cowork-style knowledge work lane.",
    markdown: workRoadmapMarkdown,
  },
};

export function getComingSoonViewContent(view: ComingSoonView) {
  return comingSoonViewContent[view];
}
