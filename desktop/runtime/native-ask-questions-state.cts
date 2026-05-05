import type { NativeAskQuestionsRequest } from '../../shared/desktop-contracts.ts'

type PendingRequest = NativeAskQuestionsRequest & {
  resolve: (answers: string[][] | null) => void
}

type RuntimeLike = {
  session: { sessionFile?: string | undefined }
}

const pendingBySessionPath = new Map<string, PendingRequest>()

export function getNativeAskQuestionsRequest(
  runtime: RuntimeLike,
): NativeAskQuestionsRequest | null {
  const sessionPath = runtime.session.sessionFile
  if (!sessionPath) return null
  const pending = pendingBySessionPath.get(sessionPath)
  return pending ? { id: pending.id, questions: pending.questions } : null
}

export function createPendingNativeAskQuestionsRequest(
  sessionPath: string,
  request: NativeAskQuestionsRequest,
  options: { signal?: AbortSignal } = {},
) {
  const existing = pendingBySessionPath.get(sessionPath)
  if (existing) {
    pendingBySessionPath.delete(sessionPath)
    existing.resolve(null)
  }

  let abort: (() => void) | null = null
  const promise = new Promise<string[][] | null>((resolve) => {
    const pending = { ...request, resolve }
    abort = () => {
      if (pendingBySessionPath.get(sessionPath) !== pending) return
      pendingBySessionPath.delete(sessionPath)
      resolve(null)
    }

    if (options.signal?.aborted) {
      resolve(null)
      return
    }

    pendingBySessionPath.set(sessionPath, pending)
    options.signal?.addEventListener('abort', abort, { once: true })
  })

  return promise.finally(() => {
    if (abort) options.signal?.removeEventListener('abort', abort)
    const current = pendingBySessionPath.get(sessionPath)
    if (current?.id === request.id) {
      pendingBySessionPath.delete(sessionPath)
    }
  })
}

export function answerNativeAskQuestions(
  runtime: RuntimeLike,
  requestId: string,
  answers: string[][] | null,
) {
  const sessionPath = runtime.session.sessionFile
  if (!sessionPath) return false
  const pending = pendingBySessionPath.get(sessionPath)
  if (!pending || pending.id !== requestId) return false
  pendingBySessionPath.delete(sessionPath)
  pending.resolve(answers)
  return true
}
