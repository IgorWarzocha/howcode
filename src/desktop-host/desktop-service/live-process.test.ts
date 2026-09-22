import { ChildProcess } from 'node:child_process'
import * as Effect from 'effect/Effect'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { desktopShutdownTimeouts } from '../../../shared/desktop-shutdown-deadlines'
import { terminateDesktopServiceProcess } from './live-process'

function makeChildProcess() {
  const child = new ChildProcess()
  const kill = vi.spyOn(child, 'kill').mockReturnValue(true)
  return { child, kill }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('lets the service use its full cleanup budget before forcing termination', async () => {
  const { child, kill } = makeChildProcess()
  const termination = Effect.runPromise(terminateDesktopServiceProcess(child))

  expect(kill).toHaveBeenCalledTimes(1)
  expect(kill).toHaveBeenLastCalledWith('SIGTERM')
  await vi.advanceTimersByTimeAsync(desktopShutdownTimeouts.desktopServiceCleanupMs)
  expect(kill).toHaveBeenCalledTimes(1)

  child.emit('exit', 0, null)
  await termination
  await vi.runAllTimersAsync()
  expect(kill).toHaveBeenCalledTimes(1)
})

it('forces a service that outlives its parent termination budget', async () => {
  const { child, kill } = makeChildProcess()
  const termination = Effect.runPromise(terminateDesktopServiceProcess(child))

  await vi.advanceTimersByTimeAsync(desktopShutdownTimeouts.desktopServiceTerminationMs - 1)
  expect(kill).toHaveBeenCalledTimes(1)
  expect(kill).toHaveBeenLastCalledWith('SIGTERM')

  await vi.advanceTimersByTimeAsync(1)
  expect(kill).toHaveBeenCalledTimes(2)
  expect(kill).toHaveBeenLastCalledWith('SIGKILL')
  child.emit('exit', null, 'SIGKILL')
  await termination
})
