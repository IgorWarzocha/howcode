import changelogMarkdown from '../../../docs/changelog.md?raw'
import roadmapMarkdown from '../../../docs/roadmap.md?raw'
import releaseMarkdown from '../../../release.md?raw'

type LandingOverviewSection = {
  title: string
  markdown: string
}

type LandingOverviewContent = {
  title: string
  sections: readonly LandingOverviewSection[]
}

const landingOverviewContent: LandingOverviewContent = {
  title: 'Howcode overview',
  sections: [
    {
      title: 'About',
      markdown: releaseMarkdown,
    },
    {
      title: 'Roadmap',
      markdown: roadmapMarkdown,
    },
    {
      title: 'Changelog',
      markdown: changelogMarkdown,
    },
  ],
}

export function getLandingOverviewContent() {
  return landingOverviewContent
}
