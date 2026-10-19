import { defineExtension, defineTool } from '@earendil-works/pi-durable'
import {
  type AppControlCaller,
  type AppControlResult,
  appControlTool,
} from '../../shared/app-control.ts'

type Dispatch = (input: unknown, caller?: AppControlCaller) => Promise<AppControlResult>
let dispatch: Dispatch | undefined

/** The service composition root binds the dispatcher before any Harness can resume. */
export function bindAppControl(execute: Dispatch) {
  if (dispatch) throw new Error('App control is already bound.')
  dispatch = execute
  return () => {
    if (dispatch === execute) dispatch = undefined
  }
}

export const AppControlTools = defineExtension({
  name: 'howcode.app-control',
  tools: [
    defineTool({
      name: appControlTool.name,
      description: appControlTool.description,
      parameters: appControlTool.inputSchema,
      executionMode: 'sequential',
      async execute(args, api, context) {
        if (!dispatch) throw new Error('App control is unavailable.')
        const result = await dispatch(args, {
          conversationId: String(api.conversationId),
          ...(context.abortSignal ? { signal: context.abortSignal } : {}),
        })
        return { output: [{ type: 'text', text: JSON.stringify(result) }] }
      },
    }),
  ],
})
