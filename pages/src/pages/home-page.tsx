import { Heart } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import changelogMarkdown from '../../../docs/changelog.md?raw'
import roadmapMarkdown from '../../../docs/roadmap.md?raw'
import { asset } from '../site-assets'
import { SiteNav } from '../site-shell'

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

export function HomePage() {
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
