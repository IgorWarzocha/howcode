import type { AppControlCaller, AppControlResult } from '../../../shared/app-control.ts'
import { createPluginConversations } from '../../plugins/conversations.ts'
import { decodeConversationId } from '../identity.ts'
import type { AppControlInput } from './input.ts'

type SelectionAction = Extract<AppControlInput, { action: 'extensions.list' | 'extensions.select' }>

/** Native self-selection and explicit external targeting share the existing host selection port. */
export async function executeSelectionAction(
  args: SelectionAction,
  caller: AppControlCaller,
): Promise<AppControlResult> {
  const conversationId = caller.kind === 'native' ? caller.conversationId : args.conversationId
  if (conversationId === undefined)
    throw new Error(
      'Extension actions require an exact native conversationId outside a native turn.',
    )
  if (
    caller.kind === 'native' &&
    args.conversationId !== undefined &&
    args.conversationId !== caller.conversationId
  )
    throw new Error('Native extension actions can target only the executing conversation.')
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
