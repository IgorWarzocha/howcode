import type { View } from '../types'

export function getDirectorySelectionAction(view: View) {
  return view === 'skills' ? 'set-selected-directory' : 'select-directory'
}

export function shouldResetDirectoryScope(activeView: View, scopedView: 'skills') {
  return activeView !== scopedView
}
