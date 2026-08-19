type PageId = 'home' | 'dependencies' | 'blog' | 'blog-worktrees'

export function getCurrentPage(): PageId {
  if (window.location.pathname.endsWith('/blog/worktrees/')) return 'blog-worktrees'
  if (window.location.pathname.endsWith('/blog/worktrees')) return 'blog-worktrees'
  if (window.location.pathname.endsWith('/blog/')) return 'blog'
  if (window.location.pathname.endsWith('/blog')) return 'blog'
  return window.location.pathname.endsWith('/dependencies/') ||
    window.location.pathname.endsWith('/dependencies')
    ? 'dependencies'
    : 'home'
}
