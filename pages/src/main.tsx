import { ArrowRight, Heart } from 'lucide-react'
import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReactMarkdown from 'react-markdown'
import changelogMarkdown from '../../docs/changelog.md?raw'
import roadmapMarkdown from '../../docs/roadmap.md?raw'
import rootPackage from '../../package.json'
import launcherPackage from '../../packages/howcode/package.json'
import './styles.css'

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

if (import.meta.env.DEV) {
  void import('react-grab')
}

const screenshots = [
  { id: 'code-mode', src: 'screenshots/code-mode.webp', alt: 'Howcode Code mode screenshot' },
  { id: 'chat-mode', src: 'screenshots/chat-mode.webp', alt: 'Howcode Chat mode screenshot' },
  {
    id: 'gitops-review',
    src: 'screenshots/gitops-review.webp',
    alt: 'Howcode GitOps review screenshot',
  },
]

function getRoadmapItems(markdown: string) {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
}

const roadmap = getRoadmapItems(roadmapMarkdown)

function BulletMarkdown({ children: markdown }: { children: string }) {
  return (
    <span className="bullet-markdown">
      <ReactMarkdown
        components={{
          p: ({ children }) => <>{children}</>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </span>
  )
}

type PageId = 'home' | 'dependencies' | 'blog' | 'blog-worktrees'

type BlogPost = {
  id: 'worktrees'
  title: string
  eyebrow: string
  date: string
  summary: string
  href: string
}

const blogPosts: BlogPost[] = [
  {
    id: 'worktrees',
    title: 'Howcode worktrees should stay out of the way.',
    eyebrow: 'work in progress',
    date: 'May 24, 2026',
    summary:
      'A short public note on the worktree layout decision: no clutter by default, normal Git underneath, and sidebar grouping on top.',
    href: 'blog/worktrees/',
  },
]

type DependencyGroup = {
  title: string
  description: string
  dependencies: Record<string, string>
}

type ChannelId = 'stable' | 'dev'

type ChangelogSection = {
  version: string
  items: string[]
}

type ChannelConfig = {
  id: ChannelId
  label: string
  eyebrow: string
  tag: string
  title: string
  description: string
  releaseUrl: string
  changelogIndex: number
  installCommands: { label: string; command: string }[]
}

const channels: Record<ChannelId, ChannelConfig> = {
  stable: {
    id: 'stable',
    label: 'Stable',
    eyebrow: 'stable channel',
    tag: 'howcode@latest',
    title: 'Try the stable launcher first.',
    description:
      'The normal channel. The launcher downloads the current stable desktop build and relaunches the cached app.',
    releaseUrl: 'https://github.com/IgorWarzocha/howcode/releases/tag/channel-main',
    changelogIndex: 0,
    installCommands: [
      { label: 'launcher', command: 'npx howcode' },
      { label: 'global install', command: 'npm i -g howcode' },
    ],
  },
  dev: {
    id: 'dev',
    label: 'Dev',
    eyebrow: 'dev channel',
    tag: 'howcode@dev',
    title: 'Try the dev launcher if you want the sharp edge.',
    description:
      'The moving dev channel. Newer, rougher, and rebuilt from the dev branch when changes land.',
    releaseUrl: 'https://github.com/IgorWarzocha/howcode/releases/tag/channel-dev',
    changelogIndex: 0,
    installCommands: [
      { label: 'launcher', command: 'npx howcode@dev' },
      { label: 'global install', command: 'npm i -g howcode@dev' },
    ],
  },
}

const channelOrder: ChannelId[] = ['stable', 'dev']

const dependencyGroups: DependencyGroup[] = [
  {
    title: 'App runtime',
    description: 'Packages shipped with or used directly by the desktop app.',
    dependencies: rootPackage.dependencies,
  },
  {
    title: 'Build, checks, and development',
    description: 'Tooling used to build, typecheck, lint, test, and package Howcode.',
    dependencies: rootPackage.devDependencies,
  },
  {
    title: 'npm launcher',
    description: 'Runtime dependencies for the small `howcode` launcher package.',
    dependencies: launcherPackage.dependencies,
  },
]

function getCurrentPage(): PageId {
  if (window.location.pathname.endsWith('/blog/worktrees/')) return 'blog-worktrees'
  if (window.location.pathname.endsWith('/blog/worktrees')) return 'blog-worktrees'
  if (window.location.pathname.endsWith('/blog/')) return 'blog'
  if (window.location.pathname.endsWith('/blog')) return 'blog'
  return window.location.pathname.endsWith('/dependencies/') ||
    window.location.pathname.endsWith('/dependencies')
    ? 'dependencies'
    : 'home'
}

function SiteNav() {
  const homeUrl = asset('')
  return (
    <nav aria-label="Primary navigation">
      <a href={`${homeUrl}#shape`}>What</a>
      <a href={`${homeUrl}#install`}>Install</a>
      <a href={`${homeUrl}#roadmap`}>Roadmap</a>
      <a href={`${homeUrl}#changelog`}>Changelog</a>
      <a href={asset('blog/')}>Blog</a>
      <a href={`${homeUrl}#about`}>Builder</a>
      <a href={asset('dependencies/')}>Deps</a>
      <a href="https://github.com/IgorWarzocha/howcode">GitHub</a>
    </nav>
  )
}

function DependencyTable({ group }: { group: DependencyGroup }) {
  const entries = Object.entries(group.dependencies).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  return (
    <article className="dependency-card">
      <div>
        <p className="label">{entries.length} packages</p>
        <h2>{group.title}</h2>
        <p>{group.description}</p>
      </div>
      <div className="dependency-list">
        {entries.map(([name, version]) => (
          <div className="dependency-row" key={name}>
            <code>{name}</code>
            <span>{version}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function DependenciesPage() {
  return (
    <main className="site-shell dependencies-page">
      <header className="nav">
        <a className="brand" href={asset('')} aria-label="Howcode home">
          <img src={asset('howcode-icon.svg')} alt="" />
          <span>howcode</span>
        </a>
        <SiteNav />
      </header>

      <section className="dependencies-hero">
        <p className="eyebrow">dependency ledger</p>
        <h1>What Howcode currently uses.</h1>
        <p className="lede">
          A plain list from the checked-in package manifests. Useful when the ecosystem is on fire
          and you want to know what is actually in the tree before installing anything.
        </p>
      </section>

      <section className="dependency-groups" aria-label="Howcode dependencies">
        {dependencyGroups.map((group) => (
          <DependencyTable group={group} key={group.title} />
        ))}
      </section>
    </main>
  )
}

function GitHubInvertocatMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 98 96" aria-hidden="true" className="github-mark">
      <path d="M41.44 69.38C28.81 67.85 19.91 58.76 19.91 46.99C19.91 42.21 21.63 37.04 24.5 33.59C23.26 30.43 23.45 23.73 24.88 20.96C28.71 20.48 33.88 22.49 36.94 25.27C40.58 24.12 44.41 23.54 49.1 23.54C53.79 23.54 57.61 24.12 61.06 25.17C64.03 22.49 69.29 20.48 73.12 20.96C74.46 23.54 74.65 30.24 73.4 33.5C76.47 37.13 78.09 42.01 78.09 46.99C78.09 58.76 69.19 67.66 56.37 69.29C59.62 71.39 61.82 75.99 61.82 81.25L61.82 91.21C61.82 94.08 64.22 95.7 67.09 94.55C84.41 87.95 98 70.63 98 49.19C98 22.11 75.99 0 48.9 0C21.82 0 0 22.11 0 49.19C0 70.44 13.49 88.05 31.68 94.65C34.26 95.61 36.75 93.88 36.75 91.3L36.75 83.64C35.41 84.22 33.69 84.6 32.16 84.6C25.84 84.6 22.11 81.16 19.43 74.74C18.38 72.16 17.23 70.63 15.03 70.34C13.88 70.25 13.49 69.77 13.49 69.19C13.49 68.04 15.41 67.18 17.32 67.18C20.1 67.18 22.49 68.91 24.98 72.45C26.89 75.22 28.9 76.47 31.29 76.47C33.69 76.47 35.22 75.61 37.42 73.4C39.05 71.78 40.29 70.34 41.44 69.38Z" />
    </svg>
  )
}

const changelogSectionHeadingPattern = /^###\s+(.+)$/
const changelogAnyHeadingPattern = /^#{3,}\s+.+$/

function copyCommand(command: string) {
  void navigator.clipboard?.writeText(command)
}

function getChangelogSections(markdown: string): ChangelogSection[] {
  const lines = markdown.split('\n')
  const sectionHeadingIndexes = lines.flatMap((line, index) =>
    changelogSectionHeadingPattern.test(line) ? [index] : [],
  )

  return sectionHeadingIndexes.map((headingIndex) => {
    const version =
      lines[headingIndex]?.match(changelogSectionHeadingPattern)?.[1]?.trim() ?? 'current'
    const nextHeadingIndex = lines.findIndex(
      (line, index) => index > headingIndex && changelogAnyHeadingPattern.test(line),
    )
    const sectionLines = lines.slice(
      headingIndex + 1,
      nextHeadingIndex >= 0 ? nextHeadingIndex : undefined,
    )
    const items = sectionLines.flatMap((line) => {
      const trimmedLine = line.trim()
      return trimmedLine.startsWith('- ') ? [trimmedLine.slice(2)] : []
    })
    return { version, items }
  })
}

function getInitialChannel(): ChannelId {
  const channel = new URLSearchParams(window.location.search).get('channel')
  return channel === 'dev' ? 'dev' : 'stable'
}

const changelogSections = getChangelogSections(changelogMarkdown)
const fallbackChangelog = {
  version: 'latest',
  items: ['See the changelog for recent fixes and shipped bits.'],
}

function HomePage() {
  const [activeChannel, setActiveChannel] = useState<ChannelId>(getInitialChannel)
  const channel = channels[activeChannel]
  const changelog =
    changelogSections[channel.changelogIndex] ?? changelogSections[0] ?? fallbackChangelog
  const [activeScreenshot, setActiveScreenshot] = useState<(typeof screenshots)[number] | null>(
    null,
  )
  const activeScreenshotIndex = useMemo(
    () => screenshots.findIndex((screenshot) => screenshot.id === activeScreenshot?.id),
    [activeScreenshot],
  )

  useEffect(() => {
    const url = new URL(window.location.href)
    if (activeChannel === 'stable') url.searchParams.delete('channel')
    else url.searchParams.set('channel', activeChannel)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [activeChannel])

  useEffect(() => {
    if (!activeScreenshot) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveScreenshot(null)
        return
      }

      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'l') {
        const previousIndex = (activeScreenshotIndex - 1 + screenshots.length) % screenshots.length
        setActiveScreenshot(screenshots[previousIndex] ?? null)
        return
      }

      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'r') {
        const nextIndex = (activeScreenshotIndex + 1) % screenshots.length
        setActiveScreenshot(screenshots[nextIndex] ?? null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeScreenshot, activeScreenshotIndex])

  return (
    <main className="site-shell">
      <header className="nav">
        <a className="brand" href="#top" aria-label="Howcode home">
          <img src={asset('howcode-icon.svg')} alt="" />
          <span>howcode</span>
        </a>
        <SiteNav />
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">pi, terminal, git</p>
          <h1>A desktop shell for coding with Pi agents.</h1>
          <p className="lede">
            Howcode is for YOLO coding with agents: composer, terminal, git operations, diff review,
            chat, local dictation, and raw Pi when you want it.
          </p>
          <div className="actions">
            <a className="button primary" href="#install">
              Install {channel.label.toLowerCase()}
            </a>
            <a
              className="button secondary github-button"
              href="https://github.com/IgorWarzocha/howcode"
            >
              <GitHubInvertocatMark />
              IgorWarzocha/howcode
            </a>
          </div>
        </div>

        <div className="hero-installer" id="install">
          <fieldset className="channel-switcher hero-channel-switcher">
            <legend className="sr-only">Release channel</legend>
            {channelOrder.map((channelId) => (
              <button
                type="button"
                key={channelId}
                className={channelId === activeChannel ? 'active' : undefined}
                onClick={() => setActiveChannel(channelId)}
              >
                {channels[channelId].label}
              </button>
            ))}
          </fieldset>
          <div className="terminal-card">
            <div className="terminal-top">
              <span>{channel.tag}</span>
              <span>
                {channel.id === 'dev' ? 'some edges very sharp' : 'some edges still sharp'}
              </span>
            </div>
            <div className="command-list">
              {channel.installCommands.map(({ command, label }) => (
                <button
                  type="button"
                  key={command}
                  className="command-row"
                  onClick={() => copyCommand(command)}
                  aria-label={`Copy ${label} command`}
                >
                  <code>{command}</code>
                  <span>copy</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="screenshot-grid" id="screenshots" aria-label="Howcode screenshots">
        {screenshots.map((screenshot) => (
          <button
            key={screenshot.id}
            className="screenshot-card"
            type="button"
            onClick={() => setActiveScreenshot(screenshot)}
          >
            <img src={asset(screenshot.src)} alt={screenshot.alt} />
          </button>
        ))}
      </section>

      {activeScreenshot ? (
        <button
          className="lightbox"
          type="button"
          onClick={() => setActiveScreenshot(null)}
          aria-label="Close screenshot"
        >
          <img src={asset(activeScreenshot.src)} alt={activeScreenshot.alt} />
        </button>
      ) : null}

      <p className="pi-credit">
        Howcode is built on top of <a href="https://pi.dev/">Pi</a>. Thank you Mario for creating
        such a based piece of software. If you want the cleaner, terminal-first thing underneath all
        this, start at <a href="https://pi.dev/">pi.dev</a>. Pi now lives with{' '}
        <a href="https://earendil.com/">Earendil</a>.
      </p>

      <section className="section statement" id="shape">
        <p className="eyebrow">what it is</p>
        <h2>Code mode, Chat mode, GitOps, Pi TUI.</h2>
        <p>
          Code mode is the main shell. Chat mode keeps Pi native tools out and gives artifacts their
          own tools. GitOps is for changed files and comments. Pi TUI is there when you want stock
          Pi inside the app.
        </p>
      </section>

      <section className="section roadmap" id="roadmap">
        <div>
          <p className="eyebrow">next</p>
          <h2>Roadmap, loosely held.</h2>
        </div>
        <ol>
          {roadmap.map((item) => (
            <li key={item}>
              <BulletMarkdown>{item}</BulletMarkdown>
            </li>
          ))}
        </ol>
      </section>

      <section className="section roadmap" id="changelog">
        <div>
          <p className="eyebrow">
            {channel.label.toLowerCase()} · {changelog.version}
          </p>
          <h2>
            {channel.id === 'dev'
              ? 'What is cooking on dev.'
              : 'Recent stable fixes and shipped bits.'}
          </h2>
        </div>
        <ol>
          {changelog.items.map((item) => (
            <li key={item}>
              <BulletMarkdown>{item}</BulletMarkdown>
            </li>
          ))}
        </ol>
      </section>

      <section className="section about" id="about">
        <div>
          <p className="eyebrow">meet the builder</p>
          <h2>Built by the bloke who got annoyed enough to make it.</h2>
        </div>
        <div className="about-copy">
          <p>
            Bristol-based. Polish-born. I spent the last year putting roughly 3,000 hours into AI
            systems, agents, local tooling, Pi, OpenCode, and OpenClaw extensions. This is the bit I
            cannot stop poking at.
          </p>
          <p>
            Before that: marketing, market intelligence, content, 2,000+ published articles, email
            campaigns, WordPress sites, photography, cultural management, venue chaos, and a bin
            route during COVID. Glamour, mostly.
          </p>
          <p>
            It helps. I know what happens when a clever system meets a messy brief, a tired user,
            and a deadline with teeth.
          </p>
          <p className="support-line">
            One-man project. If you want it sharper,{' '}
            <a href="https://github.com/sponsors/IgorWarzocha">
              <Heart aria-hidden="true" size={15} fill="currentColor" strokeWidth={2.2} />
              sponsor on GitHub
            </a>
            .
          </p>
        </div>
      </section>

      <footer>
        <span>Works on my machine™</span>
        <a className="footer-x" href="https://x.com/Howaboua">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.9 2h3.3l-7.2 8.2L23.5 22h-6.7l-5.2-6.8L5.7 22H2.3l7.7-8.8L1.8 2h6.8l4.7 6.2L18.9 2Zm-1.2 17.9h1.8L7.6 4H5.7l12 15.9Z" />
          </svg>
          @Howaboua
        </a>
      </footer>
    </main>
  )
}

function BlogIndexPage() {
  return (
    <main className="site-shell blog-page">
      <header className="nav">
        <a className="brand" href={asset('')} aria-label="Howcode home">
          <img src={asset('howcode-icon.svg')} alt="" />
          <span>howcode</span>
        </a>
        <SiteNav />
      </header>

      <section className="dependencies-hero blog-hero">
        <p className="eyebrow">public notes</p>
        <h1>What Howcode is working through.</h1>
        <p className="lede">
          Plans, design calls, and weird little decisions that are better shared than hidden in a
          private chat thread.
        </p>
      </section>

      <section className="blog-list" aria-label="Blog posts">
        {blogPosts.map((post) => (
          <a className="blog-card" href={asset(post.href)} key={post.id}>
            <span className="label">
              {post.eyebrow} · {post.date}
            </span>
            <h2>{post.title}</h2>
            <p>{post.summary}</p>
            <span className="blog-card-link">
              Read note <ArrowRight size={16} />
            </span>
          </a>
        ))}
      </section>
    </main>
  )
}

const worktreeLayoutExamples = [
  {
    title: 'Sibling suffix',
    tag: 'simple but noisy',
    pro: 'Normal folders; easy to open anywhere.',
    con: 'Parent folder gets noisy quickly.',
    description:
      'Plain sibling folders next to the main checkout. Obvious in terminal, noisy after a few branches.',
    tree: `~/Work/
├─ howcode/
├─ howcode--automations/
├─ howcode--issue-412/
└─ howcode--release-test/`,
    optionId: 'sibling-suffix',
    voteLabel: 'Vote: sibling suffix',
  },
  {
    title: 'Hidden local hub',
    tag: 'tidy managed default',
    pro: 'Keeps generated worktrees out of sight.',
    con: 'Hidden paths can feel opaque.',
    description:
      'A hidden Howcode-managed folder near the repo. Keeps normal project directories clean.',
    tree: `~/Work/
├─ howcode/
└─ .howcode-worktrees/
   └─ howcode/
      ├─ automations/
      └─ issue-412/`,
    optionId: 'hidden-local-hub',
    voteLabel: 'Vote: hidden local hub',
  },
  {
    title: 'Bare repo family folder',
    tag: 'power-user clean slate',
    pro: 'Every checkout is equal; Git is separate.',
    con: 'Awkward for existing clones.',
    description:
      'A bare Git database with equal worktrees beside it. Clean if you start this way, awkward for existing clones.',
    tree: `~/Work/howcode.repo/
├─ .bare/
├─ main/
├─ automations/
└─ issue-412/`,
    optionId: 'bare-repo-family',
    voteLabel: 'Vote: bare repo family',
  },
  {
    title: 'Project-local hidden folder',
    tag: 'contained but risky',
    pro: 'Everything stays under the project.',
    con: 'Nested checkouts confuse tools.',
    description:
      'Contained under the main project, but nested checkouts can confuse tools and agents.',
    tree: `~/Work/howcode/
├─ .git/
├─ src/
└─ .worktrees/
   ├─ automations/
   └─ issue-412/`,
    optionId: 'project-local-hidden',
    voteLabel: 'Vote: project-local hidden',
  },
  {
    title: 'Zed-style visible hub',
    tag: 'proven pattern',
    pro: 'Proven managed pattern.',
    con: 'Still creates visible clutter.',
    description: "Zed's default: a visible managed hub outside the repo, scoped by project name.",
    tree: `~/code/
├─ zed/
└─ worktrees/
   └─ zed/
      └─ my-task/
         └─ zed/`,
    optionId: 'zed-visible-hub',
    voteLabel: 'Vote: Zed-style hub',
  },
  {
    title: 'Zed-supported .git hidden style',
    tag: 'hidden Git-adjacent',
    pro: 'Tidy and Git-adjacent.',
    con: 'Needs careful excludes.',
    description: 'A hidden .git-adjacent location, matching a Zed-supported configuration style.',
    tree: `~/code/zed/
├─ .git/
│  └─ zed-worktrees/
│     └─ my-task/
└─ src/`,
    optionId: 'zed-git-hidden',
    voteLabel: 'Vote: .git hidden style',
  },
  {
    title: 'Visible worktrees container',
    tag: 'original sketch',
    pro: 'Easy to understand.',
    con: 'Feels detached from the repo.',
    description: 'The first sketch: one visible container folder for all linked checkouts.',
    tree: `~/Work/howcode/
├─ howcode/
└─ worktrees/
   ├─ howcode-automations/
   ├─ howcode-issue-412/
   └─ howcode-release-test/`,
    optionId: 'visible-container',
    voteLabel: 'Vote: visible container',
  },
]

const worktreePollId = 'worktree-layout'
const worktreePollApiUrl = 'https://howcode-polls.igorwarzocha.workers.dev'

type PollResults = {
  pollId: string
  selectedOptionId: string | null
  totalVotes: number
  options: Array<{ optionId: string; label: string; votes: number }>
}

function getVoteCount(results: PollResults | null, optionId: string) {
  return results?.options.find((option) => option.optionId === optionId)?.votes ?? 0
}

function formatVoteCount(count: number) {
  return `${count} ${count === 1 ? 'vote' : 'votes'}`
}

function WorktreesBlogPage() {
  const [activeOptionId, setActiveOptionId] = useState(worktreeLayoutExamples[0]?.optionId ?? '')
  const [pollResults, setPollResults] = useState<PollResults | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${worktreePollApiUrl}/results?pollId=${worktreePollId}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((results: PollResults) => setPollResults(results))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setPollError('Could not load poll results yet.')
      })
    return () => controller.abort()
  }, [])

  const activeExample =
    worktreeLayoutExamples.find((example) => example.optionId === activeOptionId) ??
    worktreeLayoutExamples[0]

  async function vote(optionId: string) {
    setVotingOptionId(optionId)
    setPollError(null)
    try {
      const response = await fetch(`${worktreePollApiUrl}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pollId: worktreePollId, optionId }),
      })
      const results = (await response.json()) as PollResults | { error?: string }
      if (!response.ok || 'error' in results) {
        throw new Error('error' in results ? results.error : 'Vote failed.')
      }
      setPollResults(results)
    } catch (error) {
      setPollError(error instanceof Error ? error.message : 'Could not save vote.')
    } finally {
      setVotingOptionId(null)
    }
  }

  return (
    <main className="site-shell blog-post-page">
      <header className="nav">
        <a className="brand" href={asset('')} aria-label="Howcode home">
          <img src={asset('howcode-icon.svg')} alt="" />
          <span>howcode</span>
        </a>
        <SiteNav />
      </header>

      <article className="blog-post worktrees-post">
        <p className="eyebrow">work in progress · May 24, 2026</p>
        <h1>Where should Howcode put Git worktrees?</h1>
        <section className="poll-intro">
          <div className="poll-intro-copy">
            <p>
              Git worktrees are coming to Howcode. The implementation is easy enough; the annoying
              question is where the extra checkouts should live. Too visible and your projects
              folder turns into branch confetti. Too hidden and it starts feeling like magic.
            </p>
            <p>
              I put the realistic layouts below. Click through them, then vote for the one you would
              actually want on your machine.
            </p>
          </div>
          <div className="poll-total" aria-live="polite">
            {pollResults ? formatVoteCount(pollResults.totalVotes) : 'Loading votes…'}
          </div>
        </section>

        <section className="layout-showcase" aria-label="Worktree folder layout options">
          <div className="layout-tabs" role="tablist" aria-label="Worktree layout options">
            {worktreeLayoutExamples.map((example, index) => (
              <button
                className="layout-tab"
                type="button"
                role="tab"
                aria-selected={activeExample?.optionId === example.optionId}
                data-selected={activeExample?.optionId === example.optionId ? 'true' : 'false'}
                key={example.optionId}
                onClick={() => setActiveOptionId(example.optionId)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {example.title}
              </button>
            ))}
          </div>

          {activeExample ? (
            <article className="layout-example" key={activeExample.title}>
              <div className="layout-copy">
                <div className="layout-title-row">
                  <h2>{activeExample.title}</h2>
                  <span>{activeExample.tag}</span>
                </div>
                <p>{activeExample.description}</p>
                <dl className="pros-cons">
                  <div>
                    <dt>Pro</dt>
                    <dd>{activeExample.pro}</dd>
                  </div>
                  <div>
                    <dt>Con</dt>
                    <dd>{activeExample.con}</dd>
                  </div>
                </dl>
                <pre>{activeExample.tree}</pre>
                <div className="vote-row">
                  <button
                    className="vote-link"
                    type="button"
                    disabled={votingOptionId !== null}
                    data-selected={
                      pollResults?.selectedOptionId === activeExample.optionId ? 'true' : 'false'
                    }
                    onClick={() => void vote(activeExample.optionId)}
                  >
                    {pollResults?.selectedOptionId === activeExample.optionId
                      ? 'Voted'
                      : activeExample.voteLabel}
                  </button>
                  <span className="vote-count" aria-live="polite">
                    {formatVoteCount(getVoteCount(pollResults, activeExample.optionId))}
                  </span>
                </div>
              </div>
            </article>
          ) : null}
        </section>

        {pollError ? (
          <p className="poll-error" role="status">
            {pollError}
          </p>
        ) : null}
      </article>
    </main>
  )
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

function App() {
  const page = getCurrentPage()
  if (page === 'dependencies') return <DependenciesPage />
  if (page === 'blog') return <BlogIndexPage />
  if (page === 'blog-worktrees') return <WorktreesBlogPage />
  return <HomePage />
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
