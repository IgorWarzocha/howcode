import type { ConversationId, EntryId, SubmissionId } from '@earendil-works/pi-durable'

function decodeId(value: string): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1 || String(id) !== value)
    throw new Error(`Invalid Durable identity: ${value}`)
  return id
}

// Erased brands enter only after canonical wire identities pass validation.
export function decodeConversationId(value: string) {
  return decodeId(value) as ConversationId
}
export function decodeEntryId(value: string) {
  return decodeId(value) as EntryId
}
export function decodeSubmissionId(value: string) {
  return decodeId(value) as SubmissionId
}
