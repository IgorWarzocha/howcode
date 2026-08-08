import {
  isSameReviewTarget,
  type LineRangeReviewTarget,
  type ReviewDraft,
  type ReviewTarget,
} from './review-model'

export type ReviewInteraction =
  | { kind: 'idle' }
  | { kind: 'selection'; target: LineRangeReviewTarget }
  | { kind: 'draft'; draft: ReviewDraft }

export type ReviewInteractionAction =
  | { type: 'hydrate'; draft: ReviewDraft | null }
  | { type: 'select'; target: LineRangeReviewTarget | null }
  | { type: 'start-draft'; target: ReviewTarget }
  | { type: 'set-draft-body'; body: string }
  | { type: 'reanchor'; from: ReviewTarget; to: ReviewTarget }
  | { type: 'cancel' }

export const idleReviewInteraction: ReviewInteraction = { kind: 'idle' }

function selectReviewTarget(
  current: ReviewInteraction,
  target: LineRangeReviewTarget | null,
): ReviewInteraction {
  if (!target) return idleReviewInteraction
  if (current.kind === 'draft' && isSameReviewTarget(current.draft.target, target)) return current
  return { kind: 'selection', target }
}

function startReviewDraft(current: ReviewInteraction, target: ReviewTarget): ReviewInteraction {
  if (current.kind === 'draft' && isSameReviewTarget(current.draft.target, target)) return current
  return { kind: 'draft', draft: { target, body: '' } }
}

function reanchorReviewInteraction(
  current: ReviewInteraction,
  from: ReviewTarget,
  to: ReviewTarget,
): ReviewInteraction {
  if (current.kind === 'selection' && isSameReviewTarget(current.target, from)) {
    return to.kind === 'line-range' ? { kind: 'selection', target: to } : current
  }
  if (current.kind === 'draft' && isSameReviewTarget(current.draft.target, from)) {
    return { kind: 'draft', draft: { ...current.draft, target: to } }
  }
  return current
}

export function reduceReviewInteraction(
  current: ReviewInteraction,
  action: ReviewInteractionAction,
): ReviewInteraction {
  switch (action.type) {
    case 'hydrate':
      return action.draft ? { kind: 'draft', draft: action.draft } : idleReviewInteraction
    case 'select':
      return selectReviewTarget(current, action.target)
    case 'start-draft':
      return startReviewDraft(current, action.target)
    case 'set-draft-body':
      return current.kind === 'draft'
        ? { kind: 'draft', draft: { ...current.draft, body: action.body } }
        : current
    case 'reanchor':
      return reanchorReviewInteraction(current, action.from, action.to)
    case 'cancel':
      return idleReviewInteraction
    default:
      throw new Error('Unknown review interaction action.')
  }
}

export function getReviewInteractionTarget(interaction: ReviewInteraction) {
  if (interaction.kind === 'idle') return null
  return interaction.kind === 'draft' ? interaction.draft.target : interaction.target
}

export function getReviewInteractionDraft(interaction: ReviewInteraction) {
  return interaction.kind === 'draft' ? interaction.draft : null
}
