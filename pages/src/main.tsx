import { Github, Heart } from 'lucide-react'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
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

const installCommands = [
  { label: 'launcher', command: 'npx howcode' },
  { label: 'global install', command: 'npm i -g howcode' },
]

function copyCommand(command: string) {
  void navigator.clipboard?.writeText(command)
}

const changelog = [
  '0.1.62 hotfix unpacks runtime host dependencies',
  "0.1.61: ASAR is back. And then it disappeared. And it's back again.",
  '0.1.6 added responsive layouts everywhere-ish',
  'composer now has @ file mentions and $skill mentions',
  'hardened Chat mode filesystem and extensions guardrails',
  'added a custom Chat mode system prompt and scrollable composer input',
  'Git errors are more visible now; please report any',
  'terminal is back on xterm, because addon-fit',
  'ASAR is back, TS6 is fully implemented, and CI is stricter',
  'now on @earendil-works packages. RIP',
  'https://igorwarzocha.github.io/howcode/ is live',
  '0.1.5 added Howcode and Pi JSON theme support',
]

function App() {
  const [activeScreenshot, setActiveScreenshot] = useState<(typeof screenshots)[number] | null>(
    null,
  )

  useEffect(() => {
    if (!activeScreenshot) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveScreenshot(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeScreenshot])

  return (
    <main className="site-shell">
      <header className="nav">
        <a className="brand" href="#top" aria-label="Howcode home">
          <img src={asset('howcode-icon.svg')} alt="" />
          <span>howcode</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#shape">What</a>
          <a href="#install">Install</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#changelog">Changelog</a>
          <a href="#about">Builder</a>
          <a href="https://github.com/IgorWarzocha/howcode">GitHub</a>
        </nav>
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
              Install
            </a>
            <a
              className="button secondary github-button"
              href="https://github.com/IgorWarzocha/howcode"
            >
              <Github aria-hidden="true" size={18} strokeWidth={2.2} />
              IgorWarzocha/howcode
            </a>
          </div>
        </div>

        <div className="terminal-card">
          <div className="terminal-top">
            <span>howcode@latest</span>
            <span>some edges still sharp</span>
          </div>
          <div className="command-list">
            {installCommands.map(({ command, label }) => (
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
          <p className="eyebrow">install</p>
          <h2>Try the launcher first.</h2>
        </div>
        <div className="install-copy">
          <p>
            The launcher downloads the right desktop build and relaunches the cached app. Releases
            include a Windows installer and a Linux AppImage. Mac should work. Hopefully.
          </p>
          <a className="text-link" href="https://github.com/IgorWarzocha/howcode/issues">
            Report a weird case →
          </a>
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
          <p className="eyebrow">latest</p>
          <h2>Recent fixes and shipped bits.</h2>
        </div>
        <ol>
          {changelog.map((item) => (
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

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
