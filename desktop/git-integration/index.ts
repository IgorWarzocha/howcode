import type gitContribution from '@howaboua/howcode-git/service-contribution'
import type { PluginServiceContribution, PluginServiceHost } from '@howaboua/howcode-sdk/plugins'
import { getPersistedConversationId } from '../../shared/conversation-ids.ts'
import { getComposerRequest } from '../../shared/desktop-action-payloads.ts'
import { setChatDiffPreferences } from '../chat-repository.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import type { GitMetadataPeers } from './dependencies.ts'
import { completeGitCommitMessage } from './git-commit-message.ts'
import { getDirectoryGitOpsMode } from './metadata.ts'

export function createGitIntegration(
  contribution: PluginServiceContribution,
  host: PluginServiceHost,
  peers: GitMetadataPeers,
) {
  // This adapter is selected only for this installed npm package identity.
  const git = contribution as typeof gitContribution
  return git.create(host, {
    getDirectoryGitOpsMode,
    emitDiffEvent: (event) => {
      emitDesktopEvent(event)
      host.publishEvent(event)
    },
    actionHost: (payload) => ({
      ...peers,
      persistedConversationId: getPersistedConversationId(
        typeof payload.conversationId === 'string' ? payload.conversationId : null,
      ),
      saveDiffPreferences: setChatDiffPreferences,
      completeCommitMessage: (prompt) =>
        completeGitCommitMessage(getComposerRequest(payload), prompt),
    }),
  })
}
