import { skillsComponent } from '@howcode/components/skills/ui/component'
import type { View } from '../types'

export function getDirectorySelectionAction(view: View) {
  return skillsComponent.views.some((route) => route === view)
    ? skillsComponent.directorySelectionAction
    : 'select-directory'
}

export function shouldResetDirectoryScope(activeView: View, scopedView: 'skills') {
  return activeView !== scopedView
}
