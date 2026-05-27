import { describe, expect, it } from 'vitest'
import { resolveTerminalEnv } from './terminal-command.helpers'

describe('resolveTerminalEnv', () => {
  it('advertises a portable xterm truecolor baseline for shell sessions', () => {
    const env = resolveTerminalEnv(
      { launchMode: 'shell', projectId: 'p', cols: 80, rows: 24 },
      { TERM: 'xterm' },
    )
    const readEnv = (name: string) => env[name]

    expect(readEnv('TERM')).toBe('xterm-256color')
    expect(readEnv('COLORTERM')).toBe('truecolor')
    expect(readEnv('TERM_PROGRAM')).toBeUndefined()
    expect(readEnv('HOWCODE_EMBEDDED_TERMINAL')).toBeUndefined()
  })

  it('scrubs native terminal identity and marks Pi sessions as embedded Howcode terminals', () => {
    const env = resolveTerminalEnv(
      {
        launchMode: 'pi-session',
        projectId: 'p',
        sessionPath: '/tmp/session.json',
        cols: 80,
        rows: 24,
      },
      {
        COLORTERM: '24bit',
        GHOSTTY_RESOURCES_DIR: '/ghostty',
        ITERM_SESSION_ID: 'iterm',
        KITTY_WINDOW_ID: 'kitty',
        TERM_PROGRAM: 'WezTerm',
        WEZTERM_PANE: 'pane',
      },
    )
    const readEnv = (name: string) => env[name]

    expect(readEnv('TERM')).toBe('xterm-256color')
    expect(readEnv('COLORTERM')).toBe('24bit')
    expect(readEnv('TERM_PROGRAM')).toBe('howcode')
    expect(readEnv('HOWCODE_EMBEDDED_TERMINAL')).toBe('1')
    expect(readEnv('HOWCODE_TERMINAL_CAPABILITIES')).toBe(
      'ansi,256color,truecolor,unicode,no-terminal-protocols',
    )
    expect(readEnv('GHOSTTY_RESOURCES_DIR')).toBeUndefined()
    expect(readEnv('ITERM_SESSION_ID')).toBeUndefined()
    expect(readEnv('KITTY_WINDOW_ID')).toBeUndefined()
    expect(readEnv('WEZTERM_PANE')).toBeUndefined()
  })
})
