import type { ProjectFileWriteResult } from '../../../desktop/types'

export type DiffEditingState =
  | { kind: 'idle'; error: string | null }
  | { kind: 'loading'; fileKey: string }
  | { kind: 'editing'; fileKey: string; dirty: boolean; saving: boolean; error: string | null }

export type DiffEditButtonPresentation = {
  active: boolean
  busyElsewhere: boolean
  icon: 'edit' | 'save' | 'loading'
  label: string
  saving: boolean
}

export function getDiffEditButtonPresentation(
  state: DiffEditingState,
  fileKey: string,
): DiffEditButtonPresentation {
  if (state.kind === 'idle') {
    return { active: false, busyElsewhere: false, icon: 'edit', label: 'Edit file', saving: false }
  }
  if (state.fileKey !== fileKey) {
    return { active: false, busyElsewhere: true, icon: 'edit', label: 'Edit file', saving: false }
  }
  if (state.kind === 'loading') {
    return {
      active: false,
      busyElsewhere: false,
      icon: 'loading',
      label: 'Preparing editor…',
      saving: false,
    }
  }
  if (state.saving) {
    return { active: true, busyElsewhere: false, icon: 'loading', label: 'Saving…', saving: true }
  }
  return {
    active: true,
    busyElsewhere: false,
    icon: 'save',
    label: state.dirty ? 'Save file' : 'Finish editing',
    saving: false,
  }
}

export function getFileWriteFailure(result: Exclude<ProjectFileWriteResult, { kind: 'written' }>) {
  if (result.kind === 'conflict') {
    return `Could not save ${result.path} because it changed outside Howcode.`
  }
  return `Could not save ${result.issue.path}.`
}
