/** Admit work until shutdown, then drain every operation admitted before it. */
export function createServiceWork(label: string) {
  const pending = new Set<Promise<unknown>>()
  let stopping = false
  let drain: Promise<void> | undefined

  return {
    run<A>(evaluate: () => Promise<A>): Promise<A> {
      if (stopping) return Promise.reject(new Error(`${label} service is shutting down.`))
      const task = Promise.resolve().then(evaluate)
      pending.add(task)
      void task.then(
        () => pending.delete(task),
        () => pending.delete(task),
      )
      return task
    },
    stop() {
      stopping = true
      drain ??= Promise.allSettled(pending).then(() => undefined)
      return drain
    },
  }
}
