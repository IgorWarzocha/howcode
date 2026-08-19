import { describe, expect, it } from 'vitest'
import { isLegacyLinuxCommandLauncher } from './update-legacy-integration'

const executable = "'/home/test/.cache/howcode/versions/dev-0.1.67-abc/howcode/howcode'"
const generatedWrapper = [
  '#!/bin/sh',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: Reproduces the generated legacy shell syntax.
  'export HOWCODE_REPO_ROOT=${HOWCODE_REPO_ROOT:-$(pwd)}',
  'if [ "$1" = "--headless" ] || [ "$HOWCODE_HEADLESS" = "1" ]; then',
  '  if [ "$1" = "--headless" ]; then',
  '    shift',
  `    exec ${executable} --howcode-headless --ozone-platform=headless "$@"`,
  '  fi',
  `  exec ${executable} --ozone-platform=headless "$@"`,
  'fi',
  'if command -v setsid >/dev/null 2>&1; then',
  `  setsid -f ${executable} "$@" >/dev/null 2>&1 </dev/null`,
  'else',
  `  nohup ${executable} "$@" >/dev/null 2>&1 </dev/null &`,
  'fi',
  'exit 0',
].join('\n')

describe('legacy Linux command launcher detection', () => {
  it('recognizes the exact generated wrapper', () => {
    expect(isLegacyLinuxCommandLauncher(generatedWrapper)).toBe(true)
  })

  it('rejects partial matches and modified commands', () => {
    expect(isLegacyLinuxCommandLauncher(`${generatedWrapper}\necho custom`)).toBe(false)
    expect(isLegacyLinuxCommandLauncher(generatedWrapper.replace('setsid -f', 'exec'))).toBe(false)
  })
})
