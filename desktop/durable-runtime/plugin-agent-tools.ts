import { Type } from '@earendil-works/pi-ai'
import {
  type Cursor,
  defineExtension,
  defineTool,
  GenerationTask,
  hook,
  UserEntry,
} from '@earendil-works/pi-durable'
import { freezePluginTurn, installedAgentTools } from '../plugins/runtime.ts'

/** Installed plugin tools use Durable's actual call and transcript identity, not renderer selection. */
export function installedAgentExtensions() {
  return installedAgentTools().map(({ plugin, tool }) =>
    defineExtension({
      name: `${plugin}.${tool.name}`,
      tools: [
        defineTool({
          name: tool.name,
          description: tool.description,
          parameters: Type.Object({ input: Type.String() }),
          constrainedSampling: {
            type: 'grammar',
            variants: { openai_lark: 'start: INPUT?\nINPUT: /[\\s\\S]+/' },
          },
          executionMode: 'sequential',
          async execute(args, api, context) {
            const turnId = await api.commit(async (tx) => {
              let cursor: Cursor | undefined
              do {
                const page = await tx.scanEntries(
                  { conversationId: api.conversationId },
                  100,
                  cursor,
                )
                const user = page.items.find((entry) => UserEntry.is(entry))
                if (user) return String(user.id)
                cursor = page.next
              } while (cursor !== undefined)
              throw new Error('Plugin tool invocation has no user turn.')
            }, context)
            const result = await tool.execute(args.input, {
              conversationId: String(api.conversationId),
              turnId,
              ...(context.abortSignal ? { signal: context.abortSignal } : {}),
            })
            return {
              content: [{ type: 'text', text: result.text }],
              ...(result.details ? { details: result.details } : {}),
              ...(result.isError === undefined ? {} : { isError: result.isError }),
            }
          },
        }),
      ],
      hooks: [
        hook(GenerationTask, {
          async onYield(_answer, api) {
            await freezePluginTurn(String(api.conversationId))
          },
        }),
      ],
    }),
  )
}
