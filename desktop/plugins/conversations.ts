import path from 'node:path'
import type { PluginConversation, PluginConversations } from '@howaboua/howcode-sdk/plugins'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { DEFAULT_WORKSPACE_ID } from '../../shared/desktop-workspace-contracts.ts'
import { HarnessContextEntry } from '../../shared/harness-context.ts'
import { getRuntimeConversationMetadata } from '../app-service/conversation-state.ts'
import { refreshShellIndex } from '../app-service/shell-index.ts'
import { startNewChat } from '../conversation-runtime.ts'
import { contextTranscript } from '../durable-runtime/context-transcript.ts'
import {
  getAvailableRuntimeExtensions,
  getDurableRuntime,
  readRuntimeConversationRecord,
  readRuntimeEntries,
  resolveConversation,
  resolveDefaultRuntimeAgent,
  resolveRuntimeExtensions,
  runtimeContext,
} from '../durable-runtime/host.ts'
import { getDurableModels } from '../settings/models.ts'
import { getWorkspaceNavigationState } from '../workspace-repository.ts'
import {
  admitPluginInput,
  resolveInstalledConversationAssociation,
  resolveInstalledWorkspaceAgent,
} from './runtime.ts'

function getConversation(id: string): PluginConversation {
  const metadata = getRuntimeConversationMetadata(id)
  if (!metadata || metadata.deleted) throw new Error(`Conversation not found: ${id}`)
  return {
    id,
    workspaceId: metadata.workspaceId ?? DEFAULT_WORKSPACE_ID,
    directoryId: metadata.directoryId,
  }
}

async function getAssociatedConversation(id: string): Promise<PluginConversation> {
  const seen = new Set<string>()
  let ancestor = id
  while (!seen.has(ancestor)) {
    seen.add(ancestor)
    const metadata = getRuntimeConversationMetadata(ancestor)
    if (metadata) return { ...getConversation(ancestor), id }
    const record = await readRuntimeConversationRecord(ancestor)
    if (!record) throw new Error(`Conversation not found: ${ancestor}`)
    if (record.owner) {
      ancestor = String(record.owner.conversationId)
      continue
    }
    const association = await resolveInstalledConversationAssociation(ancestor)
    if (association) return { ...validateAssociation(ancestor, association), id }
    throw new Error(`Conversation has no app association: ${id}`)
  }
  throw new Error(`Conversation ownership cycle: ${id}`)
}

function validateAssociation(id: string, association: PluginConversation) {
  if (association.id !== id)
    throw new Error('Component conversation association identity mismatch.')
  const workspace = getWorkspaceNavigationState().workspaces.find(
    (entry) => entry.id === association.workspaceId,
  )
  if (!(workspace && association.directoryId && path.isAbsolute(association.directoryId)))
    throw new Error(`Invalid component conversation workspace association: ${id}`)
  return association
}

export function createPluginConversations(): PluginConversations {
  return {
    extensions: async (id) => {
      const available = await getAvailableRuntimeExtensions()
      if (id === undefined) return { available, selected: [] }
      await getAssociatedConversation(id)
      const conversation = await resolveConversation(id)
      const agent = await conversation.agent(runtimeContext)
      return { available, selected: agent.extensions.map(({ name }) => name) }
    },
    admitInput: admitPluginInput,
    workspaceAgent: resolveInstalledWorkspaceAgent,
    defaultAgent: async (workspaceId) => {
      const workspace = getWorkspaceNavigationState().workspaces.find(
        ({ id }) => id === workspaceId,
      )
      if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
      return resolveDefaultRuntimeAgent({
        workspaceId,
        directoryId: workspace.directoryId ?? getDesktopWorkingDirectory(),
      })
    },
    transcript: async (id) => {
      await resolveConversation(id)
      return (await readRuntimeEntries(id)).flatMap((entry) =>
        (entry.model ?? []).map((message, index) => ({
          id: `${entry.id}:${index}`,
          role: message.role === 'toolResult' ? ('tool' as const) : message.role,
          text:
            typeof message.content === 'string'
              ? message.content
              : message.content
                  .map((block) => {
                    switch (block.type) {
                      case 'text':
                        return block.text
                      case 'thinking':
                        return block.redacted ? '[Redacted thinking]' : block.thinking
                      case 'image':
                        return `[Image: ${block.mimeType}]`
                      case 'toolCall':
                        return `${block.name}(${JSON.stringify(block.arguments)})`
                      default:
                        throw new Error('Unsupported transcript content.')
                    }
                  })
                  .join('\n'),
        })),
      )
    },
    workspaces: async () =>
      getWorkspaceNavigationState().workspaces.map(({ id, name, directoryId }) => ({
        id,
        name,
        directoryId: directoryId ?? null,
      })),
    list: async (workspaceId) => {
      const navigation = getWorkspaceNavigationState()
      const workspace = navigation.workspaces.find(({ id }) => id === workspaceId)
      if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
      const chats =
        workspaceId === DEFAULT_WORKSPACE_ID
          ? [...workspace.chats, ...navigation.unassignedChats]
          : workspace.chats
      return chats.flatMap(({ conversationId }) =>
        conversationId ? [getConversation(conversationId)] : [],
      )
    },
    get: getAssociatedConversation,
    create: async (workspaceId) => {
      const workspace = getWorkspaceNavigationState().workspaces.find(
        ({ id }) => id === workspaceId,
      )
      if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
      const result = await startNewChat({
        workspaceId,
        directoryId: workspace.directoryId ?? getDesktopWorkingDirectory(),
      })
      await refreshShellIndex(result.directoryId)
      return getConversation(result.conversationId)
    },
    selectExtension: async (id, name, enabled) => {
      await getAssociatedConversation(id)
      const conversation = await resolveConversation(id)
      const agent = await conversation.agent(runtimeContext)
      if (agent.extensions.some((selected) => selected.name === name) === enabled) return
      const extension = (await resolveRuntimeExtensions({ composerExtensions: [name] }))
        .extensions[0]
      if (!extension) throw new Error(`Extension not installed: ${name}`)
      await conversation.configure(
        { extensions: enabled ? { add: [extension] } : { remove: [extension] } },
        runtimeContext,
      )
    },
    compactContext: async (id) => {
      await getAssociatedConversation(id)
      const [conversation, harness] = await Promise.all([
        resolveConversation(id),
        getDurableRuntime(),
      ])
      const taskId = await conversation.compact(undefined, runtimeContext)
      const { state } = await harness.waitForTask(taskId, runtimeContext)
      if (state.outcome.status !== 'completed')
        throw new Error(`Compaction ${state.outcome.status}: ${id}`)
      // Task completion only admits the summary write. Busy runs publish it at a later boundary.
      if (state.outcome.result.submissionId) {
        const submission = await harness.submission(
          state.outcome.result.submissionId,
          runtimeContext,
        )
        if (!submission) throw new Error('Compaction summary submission is unavailable.')
        const receipt = await submission.wait(runtimeContext)
        if (receipt.status !== 'done') throw new Error('Compaction summary was not published.')
      }
      // Keep the complete summary and verbatim task content; no second summarizer or truncation.
      return contextTranscript(await conversation.context(runtimeContext))
    },
    writeContext: async ({ conversationId, sourceConversationId, label, text, requestId }) => {
      await getAssociatedConversation(conversationId)
      await getAssociatedConversation(sourceConversationId)
      const conversation = await resolveConversation(conversationId)
      const [agent, models] = await Promise.all([
        conversation.agent(runtimeContext),
        getDurableModels(),
      ])
      const model = agent.model
        ? models.getModel(agent.model.provider, agent.model.modelId)
        : undefined
      const supportsSystem =
        model &&
        [
          'openai-completions',
          'openai-responses',
          'azure-openai-responses',
          'openai-codex-responses',
          'mistral-conversations',
        ].includes(model.api) &&
        model.compat &&
        'supportsMidConvoSystemMessages' in model.compat &&
        model.compat.supportsMidConvoSystemMessages === true
      const content = `Harness context: ${label}\nSource conversation: ${sourceConversationId}\n\n${text}`
      const submission = await conversation.submit(
        {
          type: 'write',
          ...(requestId === undefined ? {} : { requestId }),
          entry: {
            kind: HarnessContextEntry.kind,
            data: { sourceConversationId, label, text },
            model: [{ role: supportsSystem ? 'system' : 'user', content, timestamp: Date.now() }],
          },
        },
        runtimeContext,
      )
      return submission.wait(runtimeContext)
    },
  }
}
