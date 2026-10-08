import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { loadAppSettings } from '../app-settings/readers.ts'
import { getDurableRuntime, runtimeContext } from '../durable-runtime/host.ts'
import { getDurableModels } from '../settings/models.ts'

export async function completeGitCommitMessage(request: ComposerStateRequest, prompt: string) {
  const settings = loadAppSettings()
  const models = await getDurableModels()
  const selection = settings.gitCommitMessageModel ?? request.composerModelSelection
  const available = await models.getAvailable()
  const model = selection
    ? available.find(
        (candidate) => candidate.provider === selection.provider && candidate.id === selection.id,
      )
    : available[0]
  if (!model) return null
  const harness = await getDurableRuntime()
  const conversation = await harness.createConversation(
    {
      ownership: { kind: 'ownerless' },
      agent: {
        model: { provider: model.provider, modelId: model.id },
        thinkingLevel: settings.gitCommitMessageThinkingLevel ?? 'off',
        tools: [],
        instructions:
          'Write one concise Git commit subject line. Use imperative mood. Return only the subject, without quotes, markdown, or explanations.',
      },
    },
    runtimeContext,
  )
  const submission = await conversation.submit({ type: 'input', content: prompt }, runtimeContext)
  await submission.wait(runtimeContext)
  const messages = (await conversation.context(runtimeContext)).messages
  const assistant = messages.findLast((message) => message.role === 'assistant')
  if (assistant?.role !== 'assistant') return null
  const text = assistant.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join(' ')
  return text || null
}
