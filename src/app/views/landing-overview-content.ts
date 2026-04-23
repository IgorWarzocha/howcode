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

const changelogMarkdown = `## April 18–19, 2026

- local Whisper dictation landed with managed model installs
- the desktop shell now runs on Electron instead of Electrobun
- launch-time layout sizing got fixed up
- composer attachment flows were polished
- stuck busy spinners after thread completion were fixed

## April 17, 2026

- CEF builds landed for Linux, Windows, and macOS
- Settings, Skills, and Extensions now have proper exit affordances
- GUI-started sessions stream correctly again
- running indicators stay in sync with real work
- Inbox now shows final replies only
- packaged builds now honor extension-provided tool names`;

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
