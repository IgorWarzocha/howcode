import type { AppControlCaller, AppControlResult } from '../../../shared/app-control.ts'
import { createPluginConversations } from '../../plugins/conversations.ts'
import { decodeConversationId } from '../identity.ts'
import type { AppControlInput } from './input.ts'

type SelectionAction = Extract<AppControlInput, { action: 'extensions.list' | 'extensions.select' }>

/** Exact targets and the native self default share the existing host selection port. */
export async function executeSelectionAction(
  args: SelectionAction,
  caller: AppControlCaller,
): Promise<AppControlResult> {
  const conversationId =
    args.conversationId ?? (caller.kind === 'native' ? caller.conversationId : undefined)
  if (conversationId === undefined)
    throw new Error(
      'Extension actions require an exact native conversationId outside a native turn.',
    )
  decodeConversationId(conversationId)
  caller.signal?.throwIfAborted()
  const conversations = createPluginConversations()
  if (args.action === 'extensions.select')
    await conversations.selectExtension(conversationId, args.extension, args.enabled)
  const inventory = await conversations.extensions(conversationId)
  return {
    conversationId,
    available: inventory.available.map(({ name, tools }) => ({ name, tools: [...tools] })),
    selected: [...inventory.selected],
  }
}
