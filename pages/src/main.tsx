import { Heart } from 'lucide-react'
import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import changelogMarkdown from '../../docs/changelog.md?raw'
import rootPackage from '../../package.json'
import launcherPackage from '../../packages/howcode/package.json'
import './styles.css'

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

if (import.meta.env.DEV) {
  void import('react-grab')
}

const keepClose = [
  'composer, terminal, and git operations',
  'comments-based diff review',
  'chat mode with artifacts and minimal tools',
  'Pi TUI takeover inside the app',
  'local dictation on CPU',
]

const refuses = [
  'a file tree by default',
  'turn-by-turn diff playback',
  'extra panels for decoration',
]

const screenshots = [
  { id: 'code-mode', src: 'screenshots/code-mode.webp', alt: 'Howcode Code mode screenshot' },
  { id: 'chat-mode', src: 'screenshots/chat-mode.webp', alt: 'Howcode Chat mode screenshot' },
  {
    id: 'gitops-review',
    src: 'screenshots/gitops-review.webp',
    alt: 'Howcode GitOps review screenshot',
  },
]

const roadmap = [
  'more cards',
  'worktrees',
  'per-project automations',
  'multiple terminals per session',
  'external terminal control for agents',
  'background mode when Pi has a server',
  'remote sessions over SSH',
  'Claw, a sidekick for managing the app',
  'Work, an office-docs lane',
]

type PageId = 'home' | 'dependencies'

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
    changelogIndex: 1,
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
      <path d="M41.4395 69.3848C28.8066 67.8535 19.9062 58.7617 19.9062 46.9902C19.9062 42.2051 21.6289 37.0371 24.5 33.5918C23.2559 30.4336 23.4473 23.7344 24.8828 20.959C28.7109 20.4805 33.8789 22.4902 36.9414 25.2656C40.5781 24.1172 44.4062 23.543 49.0957 23.543C53.7852 23.543 57.6133 24.1172 61.0586 25.1699C64.0254 22.4902 69.2891 20.4805 73.1172 20.959C74.457 23.543 74.6484 30.2422 73.4043 33.4961C76.4668 37.1328 78.0937 42.0137 78.0937 46.9902C78.0937 58.7617 69.1934 67.6621 56.3691 69.2891C59.623 71.3945 61.8242 75.9883 61.8242 81.252L61.8242 91.2051C61.8242 94.0762 64.2168 95.7031 67.0879 94.5547C84.4102 87.9512 98 70.6289 98 49.1914C98 22.1074 75.9883 0 48.9043 0C21.8203 0 0 22.1074 0 49.1914C0 70.4375 13.4941 88.0469 31.6777 94.6504C34.2617 95.6074 36.75 93.8848 36.75 91.3008L36.75 83.6445C35.4102 84.2188 33.6875 84.6016 32.1562 84.6016C25.8398 84.6016 22.1074 81.1563 19.4277 74.7441C18.375 72.1602 17.2266 70.6289 15.0254 70.3418C13.877 70.2461 13.4941 69.7676 13.4941 69.1934C13.4941 68.0449 15.4082 67.1836 17.3223 67.1836C20.0977 67.1836 22.4902 68.9063 24.9785 72.4473C26.8926 75.2227 28.9023 76.4668 31.2949 76.4668C33.6875 76.4668 35.2187 75.6055 37.4199 73.4043C39.0469 71.7773 40.291 70.3418 41.4395 69.3848Z" />
    </svg>
  )
}

const changelogHeadingPattern = /^###\s+(.+)$/

function copyCommand(command: string) {
  void navigator.clipboard?.writeText(command)
}

function getChangelogSections(markdown: string): ChangelogSection[] {
  const lines = markdown.split('\n')
  const headingIndexes = lines
    .map((line, index) => (changelogHeadingPattern.test(line) ? index : -1))
    .filter((index) => index >= 0)

  return headingIndexes.map((headingIndex, index) => {
    const version = lines[headingIndex]?.match(changelogHeadingPattern)?.[1]?.trim() ?? 'current'
    const nextHeadingIndex = headingIndexes[index + 1]
    const sectionLines = lines.slice(headingIndex + 1, nextHeadingIndex)
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

        <div className="hero-installer">
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

      <section className="two-column">
        <article>
          <span className="label">keeps close</span>
          <ul>
            {keepClose.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <span className="label">refuses, for now</span>
          <ul>
            {refuses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="section install" id="install">
        <div>
          <p className="eyebrow">install · {channel.eyebrow}</p>
          <h2>{channel.title}</h2>
        </div>
        <div className="install-copy">
          <p>
            {channel.description} Releases include a Windows installer and a Linux AppImage. Mac
            should work. Hopefully.
          </p>
          <button
            type="button"
            className="install-command"
            onClick={() => copyCommand(channel.installCommands[0]?.command ?? 'npx howcode')}
            aria-label="Copy install command"
          >
            <code>{channel.installCommands[0]?.command ?? 'npx howcode'}</code>
            <span>copy</span>
          </button>
          <div className="install-links">
            <a className="text-link" href={channel.releaseUrl}>
              See {channel.label.toLowerCase()} release →
            </a>
            <a className="text-link" href="https://github.com/IgorWarzocha/howcode/issues">
              Report a weird case →
            </a>
          </div>
        </div>
      </section>

      <section className="section roadmap" id="roadmap">
        <div>
          <p className="eyebrow">next</p>
          <h2>Roadmap, loosely held.</h2>
        </div>
        <ol>
          {roadmap.map((item) => (
            <li key={item}>{item}</li>
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
            <li key={item}>{item}</li>
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

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

function App() {
  return getCurrentPage() === 'dependencies' ? <DependenciesPage /> : <HomePage />
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
