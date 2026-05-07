import { pathToFileURL } from 'node:url'
import type { defineTool as definePiTool } from '@earendil-works/pi-coding-agent'
import type { NativeAskQuestion } from '../../shared/desktop-contracts.ts'
import { createPendingNativeAskQuestionsRequest } from '../runtime/native-ask-questions-state.ts'

type RuntimeLike = {
  session: { sessionFile?: string | undefined }
}

type AskQuestionsExtensionModule = {
  createHowcodeAskQuestionsTool: (options: {
    defineTool: typeof definePiTool
    askInComposer: (
      questions: NativeAskQuestion[],
      signal?: AbortSignal,
    ) => Promise<string[][] | null>
  }) => ReturnType<typeof definePiTool>
}

export async function createNativeAskQuestionsTools({
  defineTool,
  extensionPath,
  getRuntime,
  onStateChange,
}: {
  defineTool: typeof definePiTool
  extensionPath: string
  getRuntime: () => RuntimeLike | null
  onStateChange: () => void
}) {
  const extension = (await import(pathToFileURL(extensionPath).href)) as AskQuestionsExtensionModule
  return [
    extension.createHowcodeAskQuestionsTool({
      defineTool,
      askInComposer: async (questions, signal) => {
        const runtime = getRuntime()
        const sessionPath = runtime?.session.sessionFile ?? null
        if (!sessionPath) return null

        const id = `ask_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
        const answers = createPendingNativeAskQuestionsRequest(
          sessionPath,
          {
            id,
            questions,
          },
          signal ? { signal } : {},
        )
        onStateChange()
        return await answers.finally(onStateChange)
      },
    }),
  ]
}
