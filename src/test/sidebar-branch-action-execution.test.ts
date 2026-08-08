import { describe, expect, it } from 'vitest'
import { getDesktopBranchActionFailure } from '../app/components/sidebar/project-work/useBranchActionExecution'
import type { DesktopActionResult } from '../app/desktop/types'

function actionResult(overrides: Partial<DesktopActionResult> = {}): DesktopActionResult {
  return {
    ok: true,
    at: '2026-01-01T00:00:00.000Z',
    payload: {
      action: 'workspace.switch-branch',
      payload: { projectId: '/repo', value: 'feature' },
    },
    ...overrides,
  }
}

describe('sidebar branch action failures', () => {
  it('preserves backend failures and rejects missing or unsuccessful results', () => {
    expect(
      getDesktopBranchActionFailure(
        actionResult({ result: { error: '  Branch is checked out elsewhere.  ' } }),
        'Could not switch branch.',
      ),
    ).toBe('Branch is checked out elsewhere.')
    expect(
      getDesktopBranchActionFailure(actionResult({ ok: false }), 'Could not switch branch.'),
    ).toBe('Could not switch branch.')
    expect(getDesktopBranchActionFailure(null, 'Could not switch branch.')).toBe(
      'Could not switch branch.',
    )
    expect(getDesktopBranchActionFailure(actionResult(), 'Could not switch branch.')).toBeNull()
  })
})
