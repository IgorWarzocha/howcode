import { describe, expect, it } from 'vitest'
import {
  implementedDesktopActions,
  unimplementedDesktopActions,
} from '../../shared/desktop-action-coverage'
import { desktopActions } from '../../shared/desktop-actions'

describe('desktop action coverage', () => {
  it('keeps every declared desktop action explicitly routed or intentionally unimplemented', () => {
    const coveredActions = [...implementedDesktopActions, ...unimplementedDesktopActions]

    expect(new Set(coveredActions).size).toBe(coveredActions.length)
    expect([...coveredActions].sort()).toEqual([...desktopActions].sort())
    expect(unimplementedDesktopActions).toEqual([])
  })
})
