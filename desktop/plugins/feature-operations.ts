import type {
  FeatureOperation,
  FeatureOperationCaller,
  FeatureOperationResult,
} from '@howaboua/howcode-sdk/feature-operations'

type Binding = {
  owner: string
  operations: readonly FeatureOperation[]
  calls: Set<Promise<FeatureOperationResult>>
}
const bindings = new Map<string, Binding>()
const catalogue = new Map<string, { binding: Binding; operation: FeatureOperation }>()
const operationNamePattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/

/** Composition only: installed instances and explicitly composed shell features share a catalogue. */
export function bindFeatureOperations(owner: string, operations: readonly FeatureOperation[]) {
  if (bindings.has(owner)) throw new Error(`Feature operations already bound: ${owner}`)
  const names = new Set<string>()
  for (const operation of operations) {
    if (
      !(
        operationNamePattern.test(operation.name) &&
        operation.description.trim() &&
        operation.capability.trim()
      ) ||
      typeof operation.execute !== 'function'
    )
      throw new Error(`Invalid feature operation: ${owner}: ${operation.name}`)
    if (names.has(operation.name) || catalogue.has(operation.name))
      throw new Error(`Conflicting feature operation: ${operation.name}`)
    names.add(operation.name)
  }
  const binding: Binding = { owner, operations: [...operations], calls: new Set() }
  bindings.set(owner, binding)
  for (const operation of binding.operations) catalogue.set(operation.name, { binding, operation })
  let closing: Promise<void> | undefined
  return () => {
    if (bindings.get(owner) === binding) {
      bindings.delete(owner)
      for (const operation of binding.operations) catalogue.delete(operation.name)
    }
    closing ??= Promise.allSettled(binding.calls).then(() => undefined)
    return closing
  }
}

export function busyFeatureOperationOwners() {
  return [...bindings.values()]
    .filter((binding) => binding.calls.size > 0)
    .map(({ owner }) => owner)
}

function permits(
  operation: FeatureOperation,
  caller: FeatureOperationCaller,
  selectedCapabilities: ReadonlySet<string>,
) {
  switch (caller.kind) {
    case 'host':
      return true
    case 'mcp':
      return operation.mcp === true
    case 'native':
      return selectedCapabilities.has(operation.capability)
    default:
      return false
  }
}

/** selectedCapabilities comes from the native conversation, never the submitted arguments. */
export function listFeatureOperations(
  caller: FeatureOperationCaller,
  selectedCapabilities: ReadonlySet<string>,
): FeatureOperationResult {
  caller.signal?.throwIfAborted()
  return [...catalogue.values()]
    .filter(({ operation }) => permits(operation, caller, selectedCapabilities))
    .map(({ binding, operation }) => ({
      owner: binding.owner,
      name: operation.name,
      description: operation.description,
      inputSchema: operation.inputSchema,
    }))
}

export async function executeFeatureOperation(
  name: string,
  input: unknown,
  caller: FeatureOperationCaller,
  selectedCapabilities: ReadonlySet<string>,
): Promise<FeatureOperationResult> {
  caller.signal?.throwIfAborted()
  const entry = catalogue.get(name)
  if (!(entry && permits(entry.operation, caller, selectedCapabilities)))
    throw new Error(
      `Feature operation unavailable: ${name}. Call features.list for available operations.`,
    )
  // Reserve synchronously before yielding: retirement removes discovery, then drains these calls.
  const pending = Promise.resolve().then(() => entry.operation.execute(input, caller))
  entry.binding.calls.add(pending)
  try {
    return await pending
  } finally {
    entry.binding.calls.delete(pending)
  }
}
