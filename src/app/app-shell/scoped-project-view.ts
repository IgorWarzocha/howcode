import type { View } from '../types'

export function getProjectSelectionAction(view: View) {
  return view === 'skills' ? 'set-selected-project' : 'select-project'
}

export function shouldResetProjectScope(activeView: View, scopedView: 'skills') {
  return activeView !== scopedView
}
