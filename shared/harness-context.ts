import { defineEntry } from '@earendil-works/pi-durable'

/** Host-authored context, never human input, regardless of its provider role. */
export const HarnessContextEntry = defineEntry<{
  sourceConversationId: string
  label: string
  text: string
}>('howcode.harness-context')
