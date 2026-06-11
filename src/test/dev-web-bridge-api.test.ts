import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readObjectKeys(filePath: string, marker: string) {
  const source = readFileSync(filePath, 'utf8')
  const start = source.indexOf(marker)
  if (start < 0) {
    throw new Error(`Could not find ${marker} in ${filePath}`)
  }

  const block = source.slice(start)
  return [...block.matchAll(/^ {4}([A-Za-z][A-Za-z0-9_]+):/gm)].map((match) => match[1])
}

describe('dev web bridge API', () => {
  it('keeps browser bridge methods in parity with the Electron preload API', () => {
    const bridgeMethods = readObjectKeys('src/app/dev-web-bridge.ts', 'window.piDesktop = {')
    const preloadMethods = readObjectKeys('src/electron/preload/create-desktop-api.ts', 'return {')

    expect(new Set(bridgeMethods)).toEqual(new Set(preloadMethods))
  })
})
