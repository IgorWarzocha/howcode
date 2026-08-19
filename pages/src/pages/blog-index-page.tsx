import { ArrowRight } from 'lucide-react'
import { asset } from '../site-assets'
import { SiteNav } from '../site-shell'

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

export function BlogIndexPage() {
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
