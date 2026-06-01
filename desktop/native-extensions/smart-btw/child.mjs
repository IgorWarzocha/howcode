import { spawn } from 'node:child_process'
import { readConfig } from './config.mjs'
import { POLL_MS, QUIET_MS, READY_TIMEOUT, RESPONSE_TIMEOUT } from './constants.mjs'
import { getFinalOutput } from './output.mjs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export class BtwChild {
  constructor(cwd, onUpdate) {
    this.onUpdate = onUpdate
    this.requestId = 0
    this.stdoutBuffer = ''
    this.pending = new Map()
    this.lastEventAt = Date.now()
    this.agentEndCount = 0
    this.lastAgentMessages = []
    this.currentPartial = ''
    this.onPartial = undefined
    this.closed = false
    const cfg = readConfig()
    this.details = {
      cwd,
      model: cfg.model,
      thinking: cfg.thinking,
      messages: [],
      stderr: '',
      usage: {
        turns: 0,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
      },
    }
    const args = ['--mode', 'rpc', '--no-session']
    if (cfg.model) args.push('--model', cfg.model)
    if (cfg.thinking) args.push('--thinking', cfg.thinking)
    this.proc = spawn(cfg.command, args, {
      cwd,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PI_SMART_BTW_CHILD: '1' },
    })
    this.proc.stdout.on('data', (chunk) => this.onStdout(chunk.toString()))
    this.proc.stderr.on('data', (chunk) => {
      this.details.stderr += chunk.toString()
      this.onUpdate?.()
    })
    this.proc.on('close', (code) => {
      this.closed = true
      this.exitCode = code ?? 0
      this.rejectAll(new Error(`btw child exited with code ${this.exitCode}`))
    })
    this.proc.on('error', (error) =>
      this.rejectAll(error instanceof Error ? error : new Error(String(error))),
    )
  }

  async ready() {
    await this.send({ type: 'get_state' }, READY_TIMEOUT)
    await this.send({ type: 'set_auto_compaction', enabled: true })
    await this.send({ type: 'set_auto_retry', enabled: true })
  }

  async ask(question, onPartial, promptMessage) {
    const before = this.agentEndCount
    this.lastAgentMessages = []
    this.currentPartial = ''
    this.onPartial = onPartial
    await this.send({
      type: 'prompt',
      message:
        promptMessage ??
        [
          "Answer the user's question directly.",
          'Use available tools only if they are needed to answer accurately.',
          'Be concise unless the question requires detail.',
          `Question: ${question}`,
        ].join('\n\n'),
      streamingBehavior: 'followUp',
    })
    await this.waitForAnswer(before)
    this.onPartial = undefined
    return (getFinalOutput(this.lastAgentMessages) || this.currentPartial).trim()
  }

  async stop() {
    if (this.closed) return
    this.proc.kill('SIGTERM')
    await Promise.race([
      new Promise((resolve) => this.proc.once('close', () => resolve())),
      sleep(1000).then(() => {
        if (!this.closed) this.proc.kill('SIGKILL')
      }),
    ])
  }

  async waitForAnswer(beforeCount) {
    while (!this.closed) {
      await sleep(POLL_MS)
      const quiet = Date.now() - this.lastEventAt >= QUIET_MS
      if (this.agentEndCount > beforeCount && quiet) return
    }
    throw new Error(
      `btw child closed.${this.details.stderr ? ` Stderr: ${this.details.stderr.trim()}` : ''}`,
    )
  }

  send(command, timeoutMs = RESPONSE_TIMEOUT) {
    if (this.closed || !this.proc.stdin.writable) throw new Error('btw child RPC is not available')
    const id = `req_${++this.requestId}`
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for ${String(command.type)}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timeout })
      this.proc.stdin.write(`${JSON.stringify({ ...command, id })}\n`, (err) => {
        if (!err) return
        clearTimeout(timeout)
        this.pending.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      })
    })
  }

  onStdout(chunk) {
    this.stdoutBuffer += chunk
    const lines = this.stdoutBuffer.split('\n')
    this.stdoutBuffer = lines.pop() ?? ''
    for (const line of lines) this.handleLine(line)
  }

  handleLine(line) {
    if (!line.trim()) return
    let data
    try {
      data = JSON.parse(line)
    } catch {
      return
    }
    if (this.handleResponse(data)) return
    this.lastEventAt = Date.now()
    if (data.type === 'agent_end') this.handleAgentEnd(data)
    if (data.type === 'message_end' && data.message) this.handleMessageEnd(data.message)
    if (data.type === 'message_update') this.handleMessageUpdate(data)
  }

  handleResponse(data) {
    if (!(data.type === 'response' && typeof data.id === 'string' && this.pending.has(data.id)))
      return false
    const pending = this.pending.get(data.id)
    clearTimeout(pending.timeout)
    this.pending.delete(data.id)
    data.success === false
      ? pending.reject(new Error(String(data.error ?? `RPC ${data.command} failed`)))
      : pending.resolve(data.data)
    return true
  }

  handleAgentEnd(data) {
    this.agentEndCount++
    this.lastAgentMessages = Array.isArray(data.messages) ? data.messages : []
  }

  handleMessageUpdate(event) {
    const partial = event.assistantMessageEvent?.partial
    if (partial?.role !== 'assistant') return
    const text = getFinalOutput([partial]).trim()
    if (!text || text === this.currentPartial) return
    this.currentPartial = text
    this.onPartial?.(text)
    this.onUpdate?.()
  }

  handleMessageEnd(message) {
    this.details.messages.push(message)
    if (message.role === 'assistant') {
      this.details.usage.turns++
      this.updateUsage(message.usage)
      if (message.stopReason) this.details.stopReason = message.stopReason
      if (message.errorMessage) this.details.errorMessage = message.errorMessage
    }
    this.onUpdate?.()
  }

  updateUsage(usage) {
    if (!usage) return
    this.details.usage.input += usage.input || 0
    this.details.usage.output += usage.output || 0
    this.details.usage.cacheRead += usage.cacheRead || 0
    this.details.usage.cacheWrite += usage.cacheWrite || 0
    this.details.usage.cost += usage.cost?.total || 0
    this.details.usage.contextTokens = usage.totalTokens || 0
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pending.clear()
  }
}
