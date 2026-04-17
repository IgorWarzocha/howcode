type LandingOverviewSection = {
  markdown: string;
};

type LandingOverviewContent = {
  title: string;
  roadmap: {
    title: string;
    markdown: string;
  };
  changelog: {
    title: string;
    markdown: string;
  };
};

const roadmapMarkdown = `## Next

- command palette
- manage projects view
- drag/drop and paste attachments
- composer context meter

## Later

- in-app updates and restart
- dictation that does not suck
- real Chat, Claw, and Work surfaces
- tighter attachment semantics`;

const changelogMarkdown = `## April 17, 2026

- CEF builds landed for Linux, Windows, and macOS
- Settings, Skills, and Extensions now have proper exit affordances
- GUI-started sessions stream correctly again
- running indicators stay in sync with real work
- Inbox now shows final replies only
- packaged builds now honor extension-provided tool names

## April 14–15, 2026

- prompt queueing and stop behavior landed
- the terminal moved into a right-side drawer
- Pi takeover and git ops were cleaned up
- archived threads moved into the main view
- projects got a direct new-session action
- legacy “files changed in turn” noise was removed`;

const landingOverviewContent: LandingOverviewContent = {
  title: "Roadmap & changelog",
  roadmap: {
    title: "Roadmap",
    markdown: roadmapMarkdown,
  },
  changelog: {
    title: "Changelog",
    markdown: changelogMarkdown,
  },
};

export function getLandingOverviewContent() {
  return landingOverviewContent;
}
