import changelogMarkdown from "../../../CHANGELOG.md?raw";
import roadmapMarkdown from "../../../docs/roadmap.md?raw";

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

const landingOverviewContent: LandingOverviewContent = {
  title: "Roadmap & changelog",
  roadmap: {
    title: "Roadmap",
    markdown: roadmapMarkdown,
  },
  changelog: {
    title: "Initial release",
    markdown: changelogMarkdown,
  },
};

export function getLandingOverviewContent() {
  return landingOverviewContent;
}
