# Effect migration

Howcode uses Effect selectively for backend work with real concurrency, shared state, time, or resource ownership. This is not a plan to rewrite ordinary Promise code, React, or straightforward request handlers.

The useful migration is mostly done. The major process and runtime lifecycles now have one owner, deterministic cleanup, and tests for the races that previously lived between callbacks and timers.

## Completed boundaries

### Terminals

- Effect RPC contracts in `shared/terminal-rpc.ts`.
- Scoped terminal process and session ownership in `desktop/terminal/*`.
- Ref-backed state and PubSub event delivery.
- Awaited shutdown and transcript flushing.

### Live Pi runtimes

- Effect service/layer ownership in `desktop/runtime-host/live-runtime-registry-*`.
- Deduplicated runtime creation with Deferred.
- Separate lifecycle and mutation locks.
- Scoped runtime records and identity-safe disposal.
- Fibre-owned idle scheduling tested with TestClock.
- Interruption-safe runtime acquisition and scope-owned live update scheduling.
- Scoped composer preflight and session-tree observers replace manual Promise/interval races.

### Runtime-host process broker

- Effect-owned child processes, requests, aliases, events, and idle shutdown in `desktop/runtime-host/broker/*`.
- Schema-decoded IPC envelopes and desktop events at the child-process ingress.
- Runtime-host artifact requests execute locally without a second parent/child request protocol.
- `desktop/runtime-host/client-bridge.ts` remains the Promise/event compatibility edge.
- Startup, exit, restart, and late-message paths are generation-safe.

### Desktop service process

- Effect-owned stock-Node service lifecycle in `src/desktop-host/desktop-service/*`.
- Shared Schema-decoded service messages in `shared/desktop-service-ipc.ts`.
- Startup deduplication, request/startup timeouts, process generations, and scoped shutdown.
- Child-specific terminal RPC connection ownership.
- Disposal during startup cannot resurrect a child; stale process callbacks cannot affect its replacement.
- `src/desktop-host/desktop-service-client.ts` remains the stable class/Promise compatibility edge.
- Stock-Node, Electron, and headless HTTP cleanup share idempotent Effect shutdown gates with explicit deadlines.

## Remaining candidates

### Move Node discovery and native probing into Effect

Relevant files:

- `src/desktop-host/service-native-runtime.ts`
- `src/desktop-host/node-discovery.ts`
- `desktop/runtime-host/client-environment.ts`

These contain manual child-process output collection and timeouts. Effect could provide scoped probes, typed failures, and deterministic timeout tests. The value is real, but smaller than the completed lifecycle work.

## Plausible later work

- Turn the remaining `TerminalRpcServiceClient` compatibility class into a service only if its current focused boundary starts accumulating responsibilities again.

## Deliberately out of scope

Do not migrate code merely to increase Effect coverage. Leave these alone unless they acquire shared lifecycle or concurrency problems:

- React and renderer state.
- Ordinary IPC handlers.
- Settings, package, and skill mutations.
- SQLite repositories.
- Simple filesystem operations.
- SSE/headless transport plumbing.
- One-shot Promises with clear local ownership.

## Guardrails

- Keep Effect behind stable Promise/class facades at Electron, renderer, and dev-bridge boundaries.
- Keep dynamic broad-domain result typing at those facades; validate the envelopes and fields consumed by Effect-owned lifecycle code before dispatch.
- Put cross-runtime wire contracts in `shared/*`; do not create parallel transport shims.
- A process, runtime, timer, stream, or pending request must belong to one scope or one explicitly identified record.
- Detach by record/process identity before finalising a scope. Late callbacks must be harmless.
- Use Deferred, Ref, FiberMap, PubSub, Schedule, and TestClock instead of recreating their behaviour with callback maps and raw timers.
- Prefer deleting unreachable machinery to giving it a cleaner implementation.

## Finish line

The lifecycle migration is complete. Node probing remains a candidate only if its actual failure rate
justifies disturbing the native-runtime compatibility boundary.

After that, further Effect work needs a concrete lifecycle, concurrency, retry, stream, or typed-boundary benefit. “More Effect” is not enough.
