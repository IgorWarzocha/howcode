/*!
 * Pi auth interaction adaptation from earendil-works/pi's interactive-mode.ts.
 * MIT License — Copyright (c) 2025 Mario Zechner
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { randomUUID } from 'node:crypto'
import type { AuthEvent, AuthPrompt } from '@earendil-works/pi-ai'
import type { ProviderAuthSession } from '../../shared/provider-auth.ts'

// Pi's showAuthPrompt / notifyAuthDialog interaction, adapted for a browser-owned lease.
export class ProviderLoginSession {
  readonly controller = new AbortController()
  readonly state: { -readonly [K in keyof ProviderAuthSession]: ProviderAuthSession[K] }
  private pending: { id: string; resolve: (value: string) => void; reject: () => void } | undefined
  private lease: ReturnType<typeof setTimeout> | undefined
  private readonly deadline: ReturnType<typeof setTimeout>
  completion: Promise<void> = Promise.resolve()
  readonly id: string
  private readonly expire: () => void

  constructor(id: string, expire: () => void) {
    this.id = id
    this.expire = expire
    this.state = {
      sessionId: id,
      revision: 0,
      status: 'running',
      message: '',
      notices: [],
      prompt: null,
    }
    this.deadline = setTimeout(() => this.cancel('Login timed out.'), 10 * 60_000)
    this.deadline.unref()
    this.touch()
  }

  touch() {
    clearTimeout(this.lease)
    this.lease = setTimeout(() => {
      this.cancel('Login closed after the browser disconnected.')
      this.expire()
    }, 60_000)
    this.lease.unref()
  }

  notify(event: AuthEvent) {
    if (this.controller.signal.aborted) return
    this.state.revision++
    if (event.type === 'progress') {
      this.state.message = event.message
      return
    }
    this.state.notices = [
      ...this.state.notices
        .filter((notice) => JSON.stringify(notice) !== JSON.stringify(event))
        .slice(-19),
      event,
    ]
  }

  prompt(prompt: AuthPrompt): Promise<string> {
    this.controller.signal.throwIfAborted()
    prompt.signal?.throwIfAborted()
    if (this.pending) throw new Error('A provider requested overlapping login prompts.')
    const id = randomUUID()
    const { signal: promptSignal, ...fields } = prompt
    this.state.prompt = { ...fields, id }
    this.state.revision++
    const signal = promptSignal
      ? AbortSignal.any([this.controller.signal, promptSignal])
      : this.controller.signal
    return new Promise<string>((resolve, reject) => {
      const abort = () => reject(new Error('Login prompt cancelled.'))
      signal.addEventListener('abort', abort, { once: true })
      this.pending = { id, resolve, reject: abort }
    }).finally(() => {
      // The pending entry owns the signal handler until this prompt settles.
      if (this.pending?.id === id) {
        signal.removeEventListener('abort', this.pending.reject)
        this.pending = undefined
        this.state.prompt = null
        this.state.revision++
      }
    })
  }

  answer(id: string, value: string) {
    const prompt = this.state.prompt
    if (this.state.status !== 'running' || !this.pending || prompt?.id !== id)
      throw new Error('This login prompt is no longer active.')
    if (prompt.type === 'select' && !prompt.options.some((option) => option.id === value))
      throw new Error('Choose one of the offered login options.')
    this.pending.resolve(value)
    this.state.prompt = null
    this.state.revision++
  }

  finish(status: 'success' | 'error', message: string) {
    clearTimeout(this.deadline)
    if (this.state.status !== 'running' && status !== 'success') return
    this.state.status = status
    this.state.revision++
    this.state.message = message
    this.state.prompt = null
    this.state.notices = []
  }

  cancel(message = 'Login cancelled.') {
    clearTimeout(this.deadline)
    if (this.state.status !== 'running') return
    this.state.status = 'cancelled'
    this.state.revision++
    this.state.message = message
    this.state.prompt = null
    this.state.notices = []
    this.controller.abort()
  }

  dispose() {
    this.cancel()
    clearTimeout(this.lease)
    clearTimeout(this.deadline)
  }
}
