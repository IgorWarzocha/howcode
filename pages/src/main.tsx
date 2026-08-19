import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentPage } from './page-routing'
import { BlogIndexPage } from './pages/blog-index-page'
import { DependenciesPage } from './pages/dependencies-page'
import { HomePage } from './pages/home-page'
import { WorktreesBlogPage } from './pages/worktrees-blog-page'
import './styles.css'

if (import.meta.env.DEV) {
  void import('react-grab')
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
