import type { ITheme } from '@xterm/xterm'

const XTERM_THEME_COLOR_KEYS = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const

function resolveCssColor(element: HTMLElement, value: string, fallback: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return fallback

  const probe = element.ownerDocument.createElement('span')
  Object.assign(probe.style, { color: trimmedValue, display: 'none' })
  element.appendChild(probe)
  const resolvedColor = getComputedStyle(probe).color
  probe.remove()

  return resolvedColor || trimmedValue || fallback
}

export function buildXtermTheme(element: HTMLElement): ITheme {
  const styles = getComputedStyle(element)
  const resolve = (value: string, fallback: string) => resolveCssColor(element, value, fallback)
  const color = (cssVar: string, fallback: string) =>
    resolve(styles.getPropertyValue(cssVar), fallback)
  const theme: ITheme = {
    background: color('--term-bg', '#171923'),
    foreground: color('--term-fg', '#d5daed'),
    cursor: color('--term-cursor', '#b9bff3'),
    cursorAccent: color('--term-bg', '#171923'),
    selectionBackground: color('--terminal-selection', 'rgba(185, 191, 243, 0.18)'),
    selectionInactiveBackground: color('--terminal-selection', 'rgba(185, 191, 243, 0.18)'),
  }

  for (const [index, key] of XTERM_THEME_COLOR_KEYS.entries()) {
    theme[key] = color(`--term-color-${index}`, theme.foreground ?? '#d5daed')
  }

  return theme
}
