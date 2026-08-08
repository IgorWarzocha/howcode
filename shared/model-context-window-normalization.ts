const DOT_FORMATTED_CONTEXT_WINDOW_MAX = 1_000

type ModelWithTokenLimits = {
  contextWindow?: number | undefined | null
  maxTokens?: number | undefined | null
}

export function normalizeModelContextWindowValue(value: number): number
export function normalizeModelContextWindowValue(value: null | undefined): null | undefined
export function normalizeModelContextWindowValue(
  value: number | null | undefined,
): number | null | undefined
export function normalizeModelContextWindowValue(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return value
  }

  if (Number.isInteger(value)) {
    return value
  }

  if (value < DOT_FORMATTED_CONTEXT_WINDOW_MAX) {
    return Number(String(value).replace('.', ''))
  }

  return Math.round(value)
}

function normalizeTokenLimitField<T extends ModelWithTokenLimits>(model: T, field: keyof T) {
  const normalized = normalizeModelContextWindowValue(model[field] as number | null | undefined)
  if (normalized !== model[field]) {
    model[field] = normalized as T[keyof T]
  }
}

export function normalizeModelContextWindow<T extends ModelWithTokenLimits>(model: T): T {
  normalizeTokenLimitField(model, 'contextWindow')
  normalizeTokenLimitField(model, 'maxTokens')
  return model
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as { then?: unknown }).then === 'function'
}

function normalizeModelsResult<T extends readonly ModelWithTokenLimits[]>(models: T | Promise<T>) {
  if (isPromiseLike(models)) {
    return models.then((resolvedModels) =>
      resolvedModels.map((model) => normalizeModelContextWindow(model)),
    )
  }

  return models.map((model) => normalizeModelContextWindow(model))
}

export function normalizeModelRuntimeContextWindows<T>(modelRuntime: T): T {
  const runtime = modelRuntime as T & {
    getModel?: (...args: unknown[]) => ModelWithTokenLimits | null | undefined
    getAvailable?: (
      ...args: unknown[]
    ) => readonly ModelWithTokenLimits[] | Promise<readonly ModelWithTokenLimits[]>
  }
  const originalGetModel = runtime.getModel?.bind(runtime)
  if (originalGetModel) {
    runtime.getModel = (...args: unknown[]) => {
      const model = originalGetModel(...args)
      return model ? normalizeModelContextWindow(model) : model
    }
  }

  const originalGetAvailable = runtime.getAvailable?.bind(runtime)
  if (originalGetAvailable) {
    runtime.getAvailable = (...args: unknown[]) =>
      normalizeModelsResult(originalGetAvailable(...args))
  }

  return modelRuntime
}
