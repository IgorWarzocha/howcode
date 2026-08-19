import { useEffect, useState } from 'react'
import { asset } from '../site-assets'
import { SiteNav } from '../site-shell'

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

function isPollResults(value: PollResults | { error?: string }): value is PollResults {
  return 'pollId' in value
}

function getVoteCount(results: PollResults | null, optionId: string) {
  return results?.options.find((option) => option.optionId === optionId)?.votes ?? 0
}

function formatVoteCount(count: number) {
  return `${count} ${count === 1 ? 'vote' : 'votes'}`
}

export function WorktreesBlogPage() {
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
      if (!(response.ok && isPollResults(results))) {
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
