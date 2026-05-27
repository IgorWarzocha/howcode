import type { AgentSession } from '@earendil-works/pi-coding-agent'
import type { Mock } from 'vitest'
import { describe, expect, it, vi } from 'vitest'
import type { PiRuntime } from './types.ts'

vi.mock('./agent-session-extensions.ts', () => ({
  isHeadlessExtensionCommandRunning: vi.fn(),
}))

const { isHeadlessExtensionCommandRunning } = await import('./agent-session-extensions.ts')
const { isRuntimeBranchSummaryRunning, isRuntimeCompactingContext } = await import(
  './runtime-active-state.ts'
)
const mockIsHeadlessExtensionCommandRunning = isHeadlessExtensionCommandRunning as Mock<
  typeof isHeadlessExtensionCommandRunning
>

function runtimeState(input: { compacting: boolean; extensionCommandRunning: boolean }) {
  mockIsHeadlessExtensionCommandRunning.mockReturnValue(input.extensionCommandRunning)
  return {
    session: {
      isCompacting: input.compacting,
    },
  } as PiRuntime
}

describe('runtime active state', () => {
  it('treats Pi branch summaries from extension commands as extension work, not context compaction', () => {
    const runtime = runtimeState({ compacting: true, extensionCommandRunning: true })

    expect(isRuntimeBranchSummaryRunning(runtime)).toBe(true)
    expect(isRuntimeCompactingContext(runtime)).toBe(false)
    expect(isHeadlessExtensionCommandRunning).toHaveBeenCalledWith(runtime.session as AgentSession)
  })

  it('keeps real context compaction marked as compaction', () => {
    const runtime = runtimeState({ compacting: true, extensionCommandRunning: false })

    expect(isRuntimeBranchSummaryRunning(runtime)).toBe(false)
    expect(isRuntimeCompactingContext(runtime)).toBe(true)
  })
})
