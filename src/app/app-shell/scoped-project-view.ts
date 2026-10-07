import { skillsPlugin } from '@howcode/plugins/skills/ui/extension'
import type { View } from '../types'

export function getProjectSelectionAction(view: View) {
  return skillsPlugin.views.some((route) => route === view)
    ? skillsPlugin.projectSelectionAction
    : 'select-project'
}

export function shouldResetProjectScope(activeView: View, scopedView: 'skills') {
  return activeView !== scopedView
}
