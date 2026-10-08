import type { ChatData } from './desktop-contracts'

export function setChatStreamingState(chat: ChatData, isStreaming: boolean): ChatData {
  return chat.isStreaming === isStreaming ? chat : { ...chat, isStreaming }
}

export function setChatCompactingState(chat: ChatData, isCompacting: boolean): ChatData {
  return chat.isCompacting === isCompacting ? chat : { ...chat, isCompacting }
}
