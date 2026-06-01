import { readConfig } from './config.mjs'
import { KEY_HINT, WIDGET_ID } from './constants.mjs'
import { listSessions, sessionStatus } from './session-state.mjs'

const KEY_HINT_PREFIX_PATTERN = /^keys\s+/u

function usesDesktopWidgetProtocol() {
  return (
    process.env.HOWCODE_HANDLE_LOCAL_HOST_REQUESTS === '1' &&
    process.env.HOWCODE_EMBEDDED_TERMINAL !== '1'
  )
}

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

function buildDesktopWidgetLines(state, cfg, session) {
  const sessions = listSessions(state)
  const lines = [
    `btw ${state.folded ? 'folded' : 'open'} ${state.activeIndex + 1}/${sessions.length} ${sessionStatus(session)} ${cfg.model}:${cfg.thinking}`,
  ]
  lines.push(...sessions.map(sessionWidgetLine))
  if (!state.folded) lines.push(...session.turns.slice(-3).flatMap(turnWidgetLines))
  lines.push(KEY_HINT)
  return lines
}

function dim(theme, value) {
  return theme.fg('dim', value)
}

function color(theme, tone, value) {
  return theme.fg(tone, value)
}

function truncateQuestion(question) {
  return question.length > 120 ? `${question.slice(0, 117)}...` : question
}

function sessionLabel(theme, session, activeIndex) {
  const label = String(session.index + 1)
  if (session.index === activeIndex) return color(theme, 'accent', `[${label}]`)
  if (sessionStatus(session) === 'running') return color(theme, 'warning', label)
  if (sessionStatus(session) === 'unread') return color(theme, 'success', label)
  return dim(theme, label)
}

function tuiKeyHint() {
  return KEY_HINT.replace(KEY_HINT_PREFIX_PATTERN, '')
}

function tuiHeaderLine(theme, state, cfg, session, sessions) {
  const status = sessionStatus(session)
  const statusTone = status === 'running' ? 'warning' : status === 'failed' ? 'error' : 'success'
  const sessionNumbers = sessions
    .map((item) => sessionLabel(theme, item, state.activeIndex))
    .join(' ')
  return `${color(theme, 'accent', '╭─ btw')} ${color(theme, statusTone, status)} ${dim(theme, `${cfg.model || 'default'}:${cfg.thinking}`)} ${dim(theme, `sessions ${sessionNumbers}`)}`
}

function pushTurnLines(lines, theme, turn) {
  lines.push(`${color(theme, 'muted', '│ Q')} ${truncateQuestion(turn.question)}`)
  if (turn.error) {
    lines.push(`${color(theme, 'error', '│ ✗')} ${turn.error}`)
    return
  }
  const answer = turn.answer || turn.partial
  if (!answer) {
    lines.push(`${color(theme, 'warning', '│ … thinking')}`)
    return
  }
  if (turn.answer)
    lines.push(`${color(theme, 'success', '│ ✓ answered — see btw result in transcript')}`)
  else lines.push(`${color(theme, 'warning', '│ … thinking')}`)
}

function buildTuiWidgetLines(ctx, state, cfg, session) {
  const theme = ctx.ui.theme
  const sessions = listSessions(state)
  if (sessions.length === 0) return undefined

  const lines = [tuiHeaderLine(theme, state, cfg, session, sessions)]

  if (state.folded) {
    lines.push(`${color(theme, 'muted', '╰─')} ${dim(theme, tuiKeyHint())}`)
    return lines
  }

  for (const turn of session.turns.slice(-3)) pushTurnLines(lines, theme, turn)

  lines.push(`${color(theme, 'muted', '╰─')} ${dim(theme, tuiKeyHint())}`)
  return lines
}

function renderDesktop(ctx, state) {
  const cfg = readConfig()
  const sessions = listSessions(state)
  if (sessions.length === 0) {
    ctx.ui.setWidget(
      WIDGET_ID,
      [`btw ${state.folded ? 'folded' : 'open'} 0/0 ready ${cfg.model}:${cfg.thinking}`, KEY_HINT],
      { placement: 'aboveEditor' },
    )
    return
  }
  const session = state.sessions[state.activeIndex] ?? sessions[0]
  ctx.ui.setWidget(WIDGET_ID, buildDesktopWidgetLines(state, cfg, session), {
    placement: 'aboveEditor',
  })
}

function renderTui(ctx, state) {
  const cfg = readConfig()
  const sessions = listSessions(state)
  if (sessions.length === 0) {
    ctx.ui.setWidget(WIDGET_ID, undefined)
    return
  }
  const session = state.sessions[state.activeIndex] ?? sessions[0]
  ctx.ui.setWidget(WIDGET_ID, buildTuiWidgetLines(ctx, state, cfg, session), {
    placement: 'aboveEditor',
  })
}

export function render(ctx, state) {
  if (usesDesktopWidgetProtocol()) renderDesktop(ctx, state)
  else renderTui(ctx, state)
}
