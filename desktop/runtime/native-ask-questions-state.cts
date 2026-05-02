import type { NativeAskQuestionsRequest } from "../../shared/desktop-contracts.ts";

type PendingRequest = NativeAskQuestionsRequest & {
  resolve: (answers: string[][]) => void;
};

type RuntimeLike = {
  session: { sessionFile?: string };
};

const pendingBySessionPath = new Map<string, PendingRequest>();

export function getNativeAskQuestionsRequest(
  runtime: RuntimeLike,
): NativeAskQuestionsRequest | null {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) return null;
  const pending = pendingBySessionPath.get(sessionPath);
  return pending ? { id: pending.id, questions: pending.questions } : null;
}

export function createPendingNativeAskQuestionsRequest(
  sessionPath: string,
  request: NativeAskQuestionsRequest,
) {
  return new Promise<string[][]>((resolve) => {
    pendingBySessionPath.set(sessionPath, { ...request, resolve });
  }).finally(() => {
    pendingBySessionPath.delete(sessionPath);
  });
}

export function answerNativeAskQuestions(
  runtime: RuntimeLike,
  requestId: string,
  answers: string[][],
) {
  const sessionPath = runtime.session.sessionFile;
  if (!sessionPath) return false;
  const pending = pendingBySessionPath.get(sessionPath);
  if (!pending || pending.id !== requestId) return false;
  pendingBySessionPath.delete(sessionPath);
  pending.resolve(answers);
  return true;
}
