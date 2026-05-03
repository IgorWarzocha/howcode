const DOT_FORMATTED_CONTEXT_WINDOW_MAX = 1_000;

type ModelWithContextWindow = {
  contextWindow?: number | null;
};

export function normalizeModelContextWindowValue(value: number): number;
export function normalizeModelContextWindowValue(value: null | undefined): null | undefined;
export function normalizeModelContextWindowValue(
  value: number | null | undefined,
): number | null | undefined;
export function normalizeModelContextWindowValue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return value;
  }

  if (Number.isInteger(value)) {
    return value;
  }

  if (value < DOT_FORMATTED_CONTEXT_WINDOW_MAX) {
    return Number(String(value).replace(".", ""));
  }

  return Math.round(value);
}

export function normalizeModelContextWindow<T extends ModelWithContextWindow>(model: T): T {
  const contextWindow = normalizeModelContextWindowValue(model.contextWindow);
  if (contextWindow !== model.contextWindow) {
    model.contextWindow = contextWindow;
  }
  return model;
}

export function normalizeModelRegistryContextWindows<T>(modelRegistry: T): T {
  const registry = modelRegistry as T & {
    find?: (...args: unknown[]) => ModelWithContextWindow | null | undefined;
    getAvailable?: (...args: unknown[]) => Promise<ModelWithContextWindow[]>;
  };
  const originalFind = registry.find?.bind(registry);
  if (originalFind) {
    registry.find = (...args: unknown[]) => {
      const model = originalFind(...args);
      return model ? normalizeModelContextWindow(model) : model;
    };
  }

  const originalGetAvailable = registry.getAvailable?.bind(registry);
  if (originalGetAvailable) {
    registry.getAvailable = async (...args: unknown[]) => {
      const models = await originalGetAvailable(...args);
      return models.map((model) => normalizeModelContextWindow(model));
    };
  }

  return modelRegistry;
}
