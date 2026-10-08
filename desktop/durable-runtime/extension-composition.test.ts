import { describe, expect, it } from 'vitest'
import { getComposerRequest } from '../../shared/desktop-action-payloads.ts'
import {
  createDesktopExtensionRegistry,
  resolveDesktopExtensions,
} from './extension-composition.ts'
import { discoverConversationSkills, getConversationResourceRequest } from './extension-ingress.ts'

describe('conversation extension selection', () => {
  const registry = createDesktopExtensionRegistry()

  it('keeps explicit empty selection empty through action decoding, regardless of UI mode', () => {
    for (const composerProfile of ['chat', 'code'] as const) {
      const request = getComposerRequest({ composerProfile, composerExtensions: [] })
      expect(resolveDesktopExtensions(request, registry)).toEqual({ extensions: [] })
    }
  })

  it('rejects unknown, duplicate and malformed selection rather than falling back', () => {
    expect(() => resolveDesktopExtensions({ composerExtensions: ['unknown'] }, registry)).toThrow(
      'Unknown',
    )
    expect(() =>
      resolveDesktopExtensions({ composerExtensions: ['howcode.chat', 'howcode.chat'] }, registry),
    ).toThrow('Duplicate')
    for (const composerExtensions of [null, 'howcode.chat', [12], ['howcode.chat', null]])
      expect(() => getComposerRequest({ composerExtensions })).toThrow()
  })

  it('preserves attachment-only chat permissions while code retains filesystem tools', () => {
    const chat = resolveDesktopExtensions({ composerProfile: 'general' }, registry)
    const code = resolveDesktopExtensions({}, registry)
    const tools = (selection: typeof chat) =>
      selection.extensions.flatMap((extension) => extension.tools?.map((tool) => tool.name) ?? [])
    expect(tools(chat)).not.toContain('bash')
    expect(tools(chat)).not.toContain('write')
    expect(tools(code)).toContain('bash')
    expect(tools(code)).toContain('write')
  })

  it('derives resource scope from selection instead of incoming mode or project attribution', () => {
    const selected = resolveDesktopExtensions(
      { composerProfile: 'coding', composerExtensions: ['howcode.chat', 'howcode.resources'] },
      registry,
    )
    const agent = { ...selected, cwd: '/project' }
    expect(getConversationResourceRequest(agent)).toEqual({
      directoryId: null,
      composerProfile: 'general',
    })
    const workspace = resolveDesktopExtensions(
      { composerProfile: 'general', composerExtensions: ['howcode.resources'] },
      registry,
    )
    expect(getConversationResourceRequest({ ...workspace, cwd: '/project' })).toEqual({
      directoryId: '/project',
      composerProfile: 'coding',
    })
  })

  it('does not discover skills for an explicit empty selection', async () => {
    expect(await discoverConversationSkills({ extensions: [], cwd: '/missing-project' })).toEqual(
      [],
    )
  })
})
