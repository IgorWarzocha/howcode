import type { AppControlCaller } from '../../../shared/app-control.ts'
import { executeFeatureOperation, listFeatureOperations } from '../../plugins/feature-operations.ts'
import { resolveConversation, type runtimeContext } from '../host.ts'
import type { AppControlInput } from './input.ts'

/** Only this adapter resolves native selection; transport arguments never confer capability access. */
export async function executeFeatureAction(
  args: Extract<AppControlInput, { action: 'features.list' | 'features.call' }>,
  caller: AppControlCaller,
  context: typeof runtimeContext,
) {
  const selected = new Set<string>()
  if (caller.kind === 'native') {
    const conversation = await resolveConversation(caller.conversationId)
    const agent = await conversation.agent(context)
    for (const extension of agent.extensions) selected.add(extension.name)
  }
  return args.action === 'features.list'
    ? listFeatureOperations(caller, selected)
    : executeFeatureOperation(args.operation, args.input, caller, selected)
}
