import type { ComposerProps } from '../../components/workspace/composer'

export function useComposerAskQuestionsActions({
  chatGroupId,
  composerMode,
  nativeAskQuestionsRequest,
  projectId,
  runComposerAction,
  sessionPath,
}: {
  chatGroupId: string | null | undefined
  composerMode: 'chat' | 'code'
  nativeAskQuestionsRequest: ComposerProps['nativeAskQuestionsRequest']
  projectId: string
  runComposerAction: (
    action: Parameters<ComposerProps['onAction']>[0],
    payload: NonNullable<Parameters<ComposerProps['onAction']>[1]>,
  ) => Promise<boolean>
  sessionPath: string | null
}) {
  const answerNativeQuestions = async (answers: string[][] | null) => {
    if (!nativeAskQuestionsRequest) return false
    return await runComposerAction('composer.answer-native-questions', {
      projectId,
      sessionPath,
      composerMode,
      chatGroupId,
      requestId: nativeAskQuestionsRequest.id,
      answers,
    })
  }

  return { answerNativeQuestions }
}
