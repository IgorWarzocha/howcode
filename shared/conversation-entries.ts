export type ConversationEntryList = {
  entries: ConversationEntryPreview[]
}

export type ConversationEntryPreview = {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'summary' | 'system'
  preview: string
}
