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
  | { type: 'cancel' }

export const idleReviewInteraction: ReviewInteraction = { kind: 'idle' }

export function reduceReviewInteraction(
  current: ReviewInteraction,
  action: ReviewInteractionAction,
): ReviewInteraction {
  switch (action.type) {
    case 'hydrate':
      return action.draft ? { kind: 'draft', draft: action.draft } : idleReviewInteraction
    case 'select':
      if (!action.target) return idleReviewInteraction
      if (current.kind === 'draft' && isSameReviewTarget(current.draft.target, action.target)) {
        return current
      }
      return { kind: 'selection', target: action.target }
    case 'start-draft':
      if (current.kind === 'draft' && isSameReviewTarget(current.draft.target, action.target)) {
        return current
      }
      return { kind: 'draft', draft: { target: action.target, body: '' } }
    case 'set-draft-body':
      return current.kind === 'draft'
        ? { kind: 'draft', draft: { ...current.draft, body: action.body } }
        : current
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
