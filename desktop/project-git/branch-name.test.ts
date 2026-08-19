import { describe, expect, it } from 'vitest'
import { normalizeGitBranchName } from './branch-name.ts'

describe('normalizeGitBranchName', () => {
  it('turns common invalid branch names into nearby valid names', () => {
    expect(normalizeGitBranchName('fix sidebar spacing')).toBe('fix-sidebar-spacing')
    expect(normalizeGitBranchName('feature: sidebar? polish*')).toBe('feature-sidebar-polish')
    expect(normalizeGitBranchName('foo..bar')).toBe('foo-bar')
    expect(normalizeGitBranchName('.foo/bar.lock')).toBe('foo/bar')
    expect(normalizeGitBranchName('HEAD')).toBe('branch')
  })
})
