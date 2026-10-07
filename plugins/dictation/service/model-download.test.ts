import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { fetchDownloadResponse } from './model-download.ts'

describe('dictation download lifetime', () => {
  it('cancels a pending download at plugin shutdown', async () => {
    let requested: () => void = () => undefined
    const requestReceived = new Promise<void>((resolve) => {
      requested = resolve
    })
    const server = createServer(() => requested())
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    const controller = new AbortController()
    const download = fetchDownloadResponse(
      `http://127.0.0.1:${address.port}/model`,
      controller.signal,
    )
    try {
      await requestReceived
      controller.abort()
      await expect(download).rejects.toMatchObject({ name: 'AbortError' })
    } finally {
      controller.abort()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })
})
