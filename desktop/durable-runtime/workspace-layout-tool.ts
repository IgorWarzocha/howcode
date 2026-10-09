import { Type } from '@earendil-works/pi-ai'
import { defineExtension, defineTool } from '@earendil-works/pi-durable'
import { parseWorkspaceLayoutOperation } from '@howaboua/howcode-sdk/workspace-layout-state'
import { workspaceLayout } from '../workspace-layout.ts'

const id = Type.String({ minLength: 1 })
const axis = Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')])
const placement = Type.Union([
  Type.Literal('main'),
  Type.Literal('left'),
  Type.Literal('right'),
  Type.Literal('floating'),
  Type.Literal('inline'),
])
const operation = Type.Union([
  Type.Object({ type: Type.Literal('inspect') }),
  Type.Object({ type: Type.Literal('focus'), id }),
  Type.Object({
    type: Type.Literal('move'),
    id,
    placement,
    point: Type.Optional(
      Type.Object({
        x: Type.Number({ minimum: 0, maximum: 1 }),
        y: Type.Number({ minimum: 0, maximum: 1 }),
      }),
    ),
  }),
  Type.Object({
    type: Type.Literal('group'),
    id,
    target: id,
    whole: Type.Optional(Type.Boolean()),
  }),
  Type.Object({ type: Type.Literal('detach'), id, placement }),
  Type.Object({ type: Type.Literal('split-axis'), groupId: id, splitId: id, axis }),
  Type.Object({ type: Type.Literal('reorganize'), id, target: id, axis, before: Type.Boolean() }),
  Type.Object({ type: Type.Literal('auto-arrange'), groupId: id, axis: Type.Optional(axis) }),
  Type.Object({
    type: Type.Literal('resize-split'),
    groupId: id,
    splitId: id,
    ratio: Type.Number({ minimum: 0.1, maximum: 0.9 }),
  }),
  Type.Object({
    type: Type.Literal('sidebar-width'),
    side: Type.Union([Type.Literal('left'), Type.Literal('right')]),
    width: Type.Number({ minimum: 1 }),
  }),
  Type.Object({
    type: Type.Literal('resize'),
    id,
    patch: Type.Object({
      floatingWidth: Type.Optional(Type.Number({ minimum: 1 })),
      floatingHeight: Type.Optional(Type.Number({ minimum: 1 })),
      floatingX: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
      floatingY: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
      sidebarWidth: Type.Optional(Type.Number({ minimum: 1 })),
      weight: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    }),
  }),
])

export const WorkspaceLayoutTools = defineExtension({
  name: 'howcode.workspace-layout',
  tools: [
    defineTool({
      name: 'workspace_layout',
      description:
        "Inspect or arrange this chat's saved workspace layout. Changes appear when the chat is open. Inspect first for panel and split IDs.",
      parameters: Type.Object({ operation }),
      executionMode: 'sequential',
      async execute(args, api) {
        const conversationId = String(api.conversationId)
        const current = workspaceLayout({ action: 'read', conversationId })
        const result =
          args.operation.type === 'inspect'
            ? current
            : workspaceLayout({
                action: 'operate',
                conversationId,
                revision: current.state.revision,
                operation: parseWorkspaceLayoutOperation(args.operation),
              })
        if (result.status === 'conflict') throw new Error('Layout changed; inspect it again.')
        return { content: [{ type: 'text', text: JSON.stringify(result.state) }] }
      },
    }),
  ],
})
