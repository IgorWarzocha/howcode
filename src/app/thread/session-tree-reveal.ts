export const howcodeSessionTreeRevealEvent = 'howcode:session-tree-reveal'

export type SessionTreeRevealDetail = {
  sessionPath: string
  entryId: string
}

export function dispatchSessionTreeReveal(detail: SessionTreeRevealDetail) {
  window.dispatchEvent(
    new CustomEvent<SessionTreeRevealDetail>(howcodeSessionTreeRevealEvent, { detail }),
  )
}
