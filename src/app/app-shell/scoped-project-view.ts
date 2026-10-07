import { skillsComponent } from '@howcode/components/skills/ui/component'
import type { View } from '../types'

export function getProjectSelectionAction(view: View) {
  return skillsComponent.views.some((route) => route === view)
    ? skillsComponent.projectSelectionAction
    : 'select-project'
}

export function shouldResetProjectScope(activeView: View, scopedView: 'skills') {
  return activeView !== scopedView
}
