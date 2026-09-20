import { once } from 'node:events'
import http from 'node:http'
import { expect, it, vi } from 'vitest'
import { listenHeadlessServer } from './server'

vi.mock('../../../desktop-host/browser-upload-attachments', () => ({
  scheduleBrowserUploadComposerAttachmentsCleanup: vi.fn(),
}))
vi.mock('../ipc/desktop-request-handlers', () => ({ createDesktopRequestHandlers: vi.fn() }))
vi.mock('../runtime/app-paths', () => ({ getRendererDistDirectory: vi.fn() }))

it('releases startup subscriptions when the listen port is already occupied', async () => {
  const occupied = http.createServer()
  occupied.listen(0, '127.0.0.1')
  await once(occupied, 'listening')
  const address = occupied.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener.')
  const candidate = http.createServer()
  const releaseSubscriptions = vi.fn()
  try {
    await expect(
      listenHeadlessServer(
        candidate,
        { host: '127.0.0.1', port: address.port },
        releaseSubscriptions,
      ),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' })
    expect(candidate.listening).toBe(false)
    expect(releaseSubscriptions).toHaveBeenCalledTimes(1)
    expect(candidate.listenerCount('close')).toBe(0)
  } finally {
    const closed = once(occupied, 'close')
    occupied.close()
    await closed
  }
})
