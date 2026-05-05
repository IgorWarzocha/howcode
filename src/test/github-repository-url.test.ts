import { describe, expect, it } from 'vitest'
import {
  isSameGitHubRepository,
  parseGitHubRepositoryUrl,
} from '../../shared/github-repository-url'

describe('GitHub repository URL parsing', () => {
  it('parses common GitHub repository URL formats', () => {
    expect(parseGitHubRepositoryUrl('https://github.com/owner/repo')?.canonicalUrl).toBe(
      'https://github.com/owner/repo',
    )
    expect(parseGitHubRepositoryUrl('https://github.com/owner/repo.git')?.canonicalUrl).toBe(
      'https://github.com/owner/repo',
    )
    expect(parseGitHubRepositoryUrl('git@github.com:owner/repo.git')?.canonicalUrl).toBe(
      'https://github.com/owner/repo',
    )
    expect(parseGitHubRepositoryUrl('github.com/owner/repo')?.canonicalUrl).toBe(
      'https://github.com/owner/repo',
    )
  })

  it('ignores non-repository and non-GitHub input', () => {
    expect(parseGitHubRepositoryUrl('repo name')).toBeNull()
    expect(parseGitHubRepositoryUrl('https://example.com/owner/repo')).toBeNull()
    expect(parseGitHubRepositoryUrl('https://github.com/owner')).toBeNull()
  })

  it('compares equivalent GitHub repository origins', () => {
    expect(
      isSameGitHubRepository('git@github.com:owner/repo.git', 'https://github.com/owner/repo'),
    ).toBe(true)
    expect(
      isSameGitHubRepository('https://github.com/owner/repo', 'https://github.com/other/repo'),
    ).toBe(false)
  })
})
