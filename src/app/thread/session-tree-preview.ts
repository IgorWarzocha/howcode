import type { ThreadData } from '../desktop/types'

export const howcodeSessionTreePreviewEvent = 'howcode:session-tree-preview'

export type SessionTreePreviewDetail = {
  sessionPath: string
  /** When null, end preview and show the live thread again. */
  previewEntryId: string | null
}

export function dispatchSessionTreePreview(detail: SessionTreePreviewDetail) {
  window.dispatchEvent(
    new CustomEvent<SessionTreePreviewDetail>(howcodeSessionTreePreviewEvent, { detail }),
  )
}

export function mergePreviewThreadWithLive(
  previewThread: ThreadData,
  liveThread: ThreadData | null,
): ThreadData {
  if (!liveThread || liveThread.sessionPath !== previewThread.sessionPath) {
    return previewThread
  }
  return {
    ...previewThread,
    isStreaming: liveThread.isStreaming,
    isCompacting: liveThread.isCompacting,
    title: liveThread.title,
    diffPreferences: liveThread.diffPreferences ?? previewThread.diffPreferences,
  }
}
