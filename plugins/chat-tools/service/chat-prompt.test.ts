import { describe, expect, it } from 'vitest'
import { howcodeChatSystemPrompt, renderChatPrompt } from './chat-prompt.ts'

describe('legacy chat prompt compatibility', () => {
  it('omits the extension section when stored instructions already contain its complete prompt', () => {
    expect(renderChatPrompt(howcodeChatSystemPrompt)).toBeUndefined()
    expect(renderChatPrompt(`${howcodeChatSystemPrompt}\nCustom instructions`)).toBeUndefined()
  })

  it('still supplies chat policy for new conversations and unrelated custom instructions', () => {
    expect(renderChatPrompt()).toBe(howcodeChatSystemPrompt)
    expect(renderChatPrompt('Answer briefly.')).toBe(howcodeChatSystemPrompt)
  })
})
