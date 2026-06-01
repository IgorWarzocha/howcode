import { Box, Text } from '@earendil-works/pi-tui'
import { SHORTCUTS } from './smart-btw/constants.mjs'
import { isBtwResultMessage, sendClearedMessage, sendResultMessage } from './smart-btw/messages.mjs'
import { doneTurns, injectionText } from './smart-btw/output.mjs'
import {
  activeSession,
  clearSession,
  createInitialState,
  createSession,
  ensureSession,
  listSessions,
  parseBtwArgs,
  restoreStateFromMessages,
  runBtwTurn,
  switchRelativeSession,
} from './smart-btw/session-state.mjs'
import { render } from './smart-btw/widget.mjs'

function registerTuiMessageRenderer(pi) {
  if (
    process.env.HOWCODE_HANDLE_LOCAL_HOST_REQUESTS === '1' &&
    process.env.HOWCODE_EMBEDDED_TERMINAL !== '1'
  )
    return
  pi.registerMessageRenderer('BTW SESSION', (message, _options, theme) => {
    const details = message.details ?? {}
    if (details.kind === 'cleared') return undefined
    const box = new Box(1, 1, (value) => theme.bg('customMessageBg', value))
    const label = details.label ?? 'BTW SESSION'
    const status = details.error ? theme.fg('error', `${label} failed`) : theme.fg('accent', label)
    const question = details.question ?? ''
    const body = details.answer ?? details.error ?? String(message.content ?? '')
    box.addChild(new Text(`${status} ${theme.fg('muted', 'Q')} ${question}\n\n${body}`, 0, 0))
    return box
  })
}

function activate(state, ctx) {
  state.ctx = ctx
  restoreStateFromMessages(
    state,
    ctx.sessionManager?.getBranch?.().filter((message) => isBtwResultMessage(message)) ?? [],
  )
}

function injectAnswers(pi, state, ctx) {
  activate(state, ctx)
  const session = activeSession(state)
  const turns = doneTurns(session?.turns ?? [])
  if (turns.length === 0) {
    state.ctx?.ui.notify('No /btw answer to inject yet.', 'warning')
    return
  }
  pi.sendUserMessage(
    injectionText(turns),
    state.ctx?.isIdle() ? undefined : { deliverAs: 'followUp' },
  )
  sendClearedMessage(pi, session)
  void clearSession(state, session)
  render(state.ctx, state)
}

function registerShortcuts(pi, state) {
  pi.registerShortcut(SHORTCUTS.compose, {
    description: 'Prefill /btw in the prompt editor',
    handler: async (ctx) => {
      const current = ctx.ui.getEditorText()
      ctx.ui.setEditorText(current.trim() ? `${current.trimEnd()} /btw ` : '/btw ')
    },
  })
  pi.registerShortcut(SHORTCUTS.inject, {
    description: 'Inject and clear active /btw session',
    handler: async (ctx) => injectAnswers(pi, state, ctx),
  })
  pi.registerShortcut(SHORTCUTS.clear, {
    description: 'Clear active /btw session',
    handler: async (ctx) => {
      activate(state, ctx)
      const session = activeSession(state)
      if (session) {
        sendClearedMessage(pi, session)
        await clearSession(state, session)
      }
      if (state.ctx) render(state.ctx, state)
    },
  })
  pi.registerShortcut(SHORTCUTS.fold, {
    description: 'Fold active /btw block',
    handler: async (ctx) => {
      activate(state, ctx)
      state.folded = true
      if (state.ctx) render(state.ctx, state)
    },
  })
  pi.registerShortcut(SHORTCUTS.unfold, {
    description: 'Open active /btw block',
    handler: async (ctx) => {
      activate(state, ctx)
      state.folded = false
      const session = activeSession(state)
      if (session) session.unread = false
      if (state.ctx) render(state.ctx, state)
    },
  })
  registerSessionSwitchShortcuts(pi, state)
}

function registerSessionSwitchShortcuts(pi, state) {
  const switchSession = (ctx, direction) => {
    activate(state, ctx)
    if (state.sessions.length === 0) return
    switchRelativeSession(state, direction)
    if (state.ctx) render(state.ctx, state)
  }
  pi.registerShortcut(SHORTCUTS.next, {
    description: 'Next /btw session',
    handler: async (ctx) => switchSession(ctx, 1),
  })
  pi.registerShortcut(SHORTCUTS.previous, {
    description: 'Previous /btw session',
    handler: async (ctx) => switchSession(ctx, -1),
  })
  for (let index = 1; index <= 9; index++) {
    pi.registerShortcut(`ctrl+alt+${index}`, {
      description: `Open /btw session ${index}`,
      handler: async (ctx) => {
        activate(state, ctx)
        ensureSession(state, index - 1)
        if (state.ctx) render(state.ctx, state)
      },
    })
  }
}

function registerBtwCommand(pi, state) {
  pi.registerCommand('btw', {
    description:
      'Ask or continue an async side-session. Use /btw 1, /btw 2, etc. to switch or target sessions.',
    handler: async (args, ctx) => {
      const { question, sessionNumber } = parseBtwArgs(args)
      activate(state, ctx)
      if (sessionNumber !== undefined) {
        if (sessionNumber < 1) {
          ctx.ui.notify('Use /btw 1, /btw 2, etc. to pick a btw session.', 'warning')
          return
        }
        ensureSession(state, sessionNumber - 1)
      }
      if (!question) {
        state.folded = false
        const session = activeSession(state)
        if (session) session.unread = false
        render(ctx, state)
        return
      }
      queueQuestionTurn({ ctx, pi, question, state })
    },
  })
}

function queueQuestionTurn({ ctx, pi, question, state }) {
  const session = activeSession(state) ?? createSession(state)
  const turn = { question, startedAt: Date.now(), status: 'queued' }
  session.turns.push(turn)
  state.folded = false
  session.unread = false
  render(ctx, state)
  const generation = session.generation
  session.queue = session.queue
    .catch(() => undefined)
    .then(() =>
      runBtwTurn({
        ctx,
        pi,
        question,
        state,
        session,
        turn,
        generation,
        sendResultMessage,
        render,
      }),
    )
}

export default function (pi) {
  if (process.env.PI_SMART_BTW_CHILD === '1') return
  const state = createInitialState()
  registerTuiMessageRenderer(pi)
  pi.on('context', async (event) => {
    restoreStateFromMessages(
      state,
      event.messages.filter((message) => isBtwResultMessage(message)),
    )
    return { messages: event.messages.filter((message) => !isBtwResultMessage(message)) }
  })
  registerShortcuts(pi, state)
  registerBtwCommand(pi, state)
  pi.on('session_shutdown', async () => {
    for (const session of listSessions(state)) await session.child?.stop()
  })
}
