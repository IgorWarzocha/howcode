import type { ComposerStateRequest } from '../shared/desktop-contracts.ts'
import type { CommitMessageContext } from './project-git.ts'
import { invokeRuntimeHost } from './runtime-host/client-bridge.ts'

export function generateGitCommitMessage(
  request: ComposerStateRequest,
  context: CommitMessageContext,
) {
  return invokeRuntimeHost('generateGitCommitMessage', { request, context })
}
