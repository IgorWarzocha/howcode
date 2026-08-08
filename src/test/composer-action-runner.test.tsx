import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useComposerActionRunner } from '../app/composer/controller/useComposerActionRunner'
import type { DesktopActionInvoker, DesktopActionResult } from '../app/desktop/types'

function actionResult(overrides: Partial<DesktopActionResult> = {}): DesktopActionResult {
  return {
    ok: true,
    at: '2026-01-01T00:00:00.000Z',
    payload: {
      action: 'composer.session-tree.navigate',
      payload: { projectId: '/repo', targetEntryId: 'entry' },
    },
    ...overrides,
  }
}

function renderActionRunner(onAction: DesktopActionInvoker) {
  let draft = ''
  let errorMessage: string | null = null
  let openMenu: 'model' | 'picker' | null = 'model'
  const rendered: { runner?: ReturnType<typeof useComposerActionRunner> } = {}

  function Harness() {
    rendered.runner = useComposerActionRunner({
      onAction,
      setDraft: (value) => {
        draft = value
      },
      setErrorMessage: (value) => {
        errorMessage = value
      },
      setOpenMenu: (value) => {
        openMenu = typeof value === 'function' ? value(openMenu) : value
      },
    })
    return null
  }

  renderToStaticMarkup(<Harness />)
  const runner = rendered.runner
  if (!runner) throw new Error('Composer action runner did not render.')

  return {
    runner,
    state: () => ({ draft, errorMessage, openMenu }),
  }
}

describe('composer action runner', () => {
  it('surfaces backend failures without applying action cleanup', async () => {
    const onAction = vi.fn<DesktopActionInvoker>(async () =>
      actionResult({ ok: false, result: { error: 'Extension shortcut failed.' } }),
    )
    const harness = renderActionRunner(onAction)

    const result = await harness.runner.invokeComposerAction('composer.pi-extension-shortcut', {
      projectId: '/repo',
      shortcut: 'ctrl+k',
    })

    expect(result).toBeNull()
    expect(harness.state()).toEqual({
      draft: '',
      errorMessage: 'Extension shortcut failed.',
      openMenu: 'model',
    })
  })

  it('applies successful session navigation before closing the menu', async () => {
    const onAction = vi.fn<DesktopActionInvoker>(async () =>
      actionResult({ result: { sessionTreeNavigateEditorText: 'restored draft' } }),
    )
    const harness = renderActionRunner(onAction)

    const ok = await harness.runner.runComposerAction('composer.session-tree.navigate', {
      projectId: '/repo',
      targetEntryId: 'entry',
    })

    expect(ok).toBe(true)
    expect(harness.state()).toEqual({
      draft: 'restored draft',
      errorMessage: null,
      openMenu: null,
    })
  })

  it('keeps cancelled session navigation local state unchanged', async () => {
    const onAction = vi.fn<DesktopActionInvoker>(async () =>
      actionResult({ result: { sessionTreeNavigateCancelled: true } }),
    )
    const harness = renderActionRunner(onAction)

    const ok = await harness.runner.runComposerAction('composer.session-tree.navigate', {
      projectId: '/repo',
      targetEntryId: 'entry',
    })

    expect(ok).toBe(false)
    expect(harness.state()).toEqual({ draft: '', errorMessage: null, openMenu: 'model' })
  })
})
