import releaseMarkdown from "../../../release.md?raw";
import changelogMarkdown from "../../../docs/changelog.md?raw";
import roadmapMarkdown from "../../../docs/roadmap.md?raw";

type LandingOverviewSection = {
  title: string;
  markdown: string;
};

type LandingOverviewContent = {
  title: string;
  sections: readonly LandingOverviewSection[];
};

const landingOverviewContent: LandingOverviewContent = {
  title: "Howcode overview",
  sections: [
    {
      title: "Initial roadmap",
      markdown: roadmapMarkdown,
    },
    {
      title: "Initial release",
      markdown: releaseMarkdown,
    },
    {
      title: "Changelog",
      markdown: changelogMarkdown,
    },
  ],
};

export function getLandingOverviewContent() {
  return landingOverviewContent;
}
