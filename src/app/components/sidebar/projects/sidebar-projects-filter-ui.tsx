import { Clock3, Github, ListFilter, SquareTerminal, Star } from 'lucide-react'
import type { View } from '../../../types'
import type { SidebarProjectsFilterMode } from './sidebar-projects.helpers'

export function shouldShowSidebarProjects(activeView: View) {
  return activeView !== 'inbox' && activeView !== 'claw' && activeView !== 'work'
}

export function getSidebarProjectFilterLabel(filterMode: SidebarProjectsFilterMode) {
  if (filterMode === 'favourites') return 'Show favourites'
  if (filterMode === 'github') return 'Show GitHub projects'
  if (filterMode === 'terminal') return 'Show threads with running terminals'
  if (filterMode === 'recent') return 'Show threads active since launch'
  return 'Filter projects'
}

export function getSidebarProjectFilterIcon(filterMode: SidebarProjectsFilterMode) {
  if (filterMode === 'favourites') return <Star size={15} className="fill-current" />
  if (filterMode === 'github') return <Github size={15} />
  if (filterMode === 'terminal') return <SquareTerminal size={15} />
  if (filterMode === 'recent') return <Clock3 size={15} />
  return <ListFilter size={15} />
}
