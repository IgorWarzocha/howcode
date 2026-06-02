import { readConfig } from './config.mjs'
import { KEY_HINT, WIDGET_ID } from './constants.mjs'
import { sessionStatus } from './session-state.mjs'

function sessionWidgetLine(session) {
  const first = session.turns[0]
  return `session ${session.index + 1} ${sessionStatus(session)} ${encodeWidgetText(first?.question ?? 'btw session')}`
}

function encodeWidgetText(value) {
  return JSON.stringify(String(value))
}

function turnWidgetLines(turn) {
  const status = turn.error ? 'failed' : turn.answer ? 'answered' : (turn.status ?? 'thinking')
  const lines = [`turn ${status} ${encodeWidgetText(turn.question)}`]
  if (turn.answer || turn.error || turn.partial)
    lines.push(`answer ${encodeWidgetText(turn.answer || turn.error || turn.partial)}`)
  return lines
}

function buildWidgetLines(state, cfg, session) {
  const lines = [
    `btw ${state.folded ? 'folded' : 'open'} ${state.activeIndex + 1}/${state.sessions.length} ${sessionStatus(session)} ${cfg.model}:${cfg.thinking}`,
  ]
  lines.push(...state.sessions.map(sessionWidgetLine))
  if (!state.folded) lines.push(...session.turns.slice(-3).flatMap(turnWidgetLines))
  lines.push(KEY_HINT)
  return lines
}

export function render(ctx, state) {
  const cfg = readConfig()
  if (state.sessions.length === 0) {
    ctx.ui.setWidget(
      WIDGET_ID,
      [`btw ${state.folded ? 'folded' : 'open'} 0/0 ready ${cfg.model}:${cfg.thinking}`, KEY_HINT],
      { placement: 'aboveEditor' },
    )
    return
  }
  const session = state.sessions[state.activeIndex] ?? state.sessions[0]
  ctx.ui.setWidget(WIDGET_ID, buildWidgetLines(state, cfg, session), { placement: 'aboveEditor' })
}
