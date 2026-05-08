# Server mode research: T3 Code, Effect v4, and Howcode

Related epic: [#226](https://github.com/IgorWarzocha/howcode/issues/226).  Local references cloned for inspection:

- `Frameworks/t3-code`
- `Frameworks/effect-smol`

## What T3 Code did

T3 Code is already split into three runtime surfaces:

- `apps/server`: the authoritative execution environment. It owns projects, orchestration, providers, terminals, git/VCS, settings, auth, persistence, and static/web hosting.
- `apps/web`: a browser client. It discovers/connects to one or more execution environments over HTTP/WebSocket.
- `apps/desktop`: a desktop shell/bootstrapper around the same server/client model.

The important architectural move is that **remoteness is expressed as an environment connection**, not as a pile of renderer-specific IPC exceptions. A client connects to an `ExecutionEnvironment` through a `KnownEnvironment` and an access endpoint. The server remains authoritative for runtime state.

Key files in the clone:

- `Frameworks/t3-code/.docs/remote-architecture.md`
- `Frameworks/t3-code/apps/server/src/server.ts`
- `Frameworks/t3-code/apps/server/src/ws.ts`
- `Frameworks/t3-code/packages/contracts/src/rpc.ts`
- `Frameworks/t3-code/apps/web/src/environmentApi.ts`
- `Frameworks/t3-code/apps/web/src/environments/primary/*`
- `Frameworks/t3-code/apps/web/src/environments/remote/*`
- `Frameworks/t3-code/apps/web/src/environments/runtime/*`

## Effect v4 patterns worth copying

T3 Code uses `effect@4.0.0-beta.59` and the unstable v4 HTTP/RPC APIs:

- contracts are `effect/Schema` values in `packages/contracts`
- websocket methods are one `WsRpcGroup` in `packages/contracts/src/rpc.ts`
- server handlers are implemented with `RpcServer.toHttpEffectWebsocket(WsRpcGroup, ...)`
- the server is launched as a Layer graph with `Layer.launch(makeServerLayer)`
- platform differences are hidden behind layers (`@effect/platform-node` vs `@effect/platform-bun`)
- request errors are typed with `Schema.TaggedErrorClass` / `Data.TaggedError`
- streams are represented as RPC streams, not ad-hoc event emitters

Effect-smol confirms the v4 direction for lower-level transports too:

- `effect/unstable/socket/SocketServer.ts` exposes a `SocketServer` service with `address` and `run(handler)`.
- `packages/platform-node/test/NodeSocket.test.ts` shows scoped socket handling, websocket clients via `Socket.makeWebSocket`, `Queue`, `Stream`, and explicit close-code handling.

For Howcode, Effect should be adopted at the server boundary and service graph, not sprinkled through the React UI first.

## How T3 separates server mode and client mode

### Server mode

`apps/server/src/server.ts` composes a large layer graph:

- HTTP server layer selected by runtime (`BunHttpServer` or `NodeHttpServer`)
- route layer composed from auth, static assets, attachments, orchestration HTTP, and websocket RPC
- runtime services for providers, orchestration, persistence, terminals, git/VCS, settings, environment identity, auth, and observability
- startup/shutdown side effects as scoped layers: runtime state file, listening marker, Tailscale Serve setup/cleanup

The process entrypoint is a CLI (`apps/server/src/bin.ts`) that resolves config, provides only `ServerConfig`, then launches the server layer.

### Client mode

`apps/web` never assumes a local desktop API is the runtime. It resolves a target:

- desktop-managed local target from a desktop bootstrap object
- configured target from env vars
- window-origin target for same-origin deployments
- saved remote targets with bearer auth and websocket token exchange

`environmentApi.ts` adapts a `WsRpcClient` into a domain API. The UI asks for an API by `environmentId`, and state is scoped by environment to avoid ID collisions.

### Desktop mode

Desktop mainly bootstraps a local server and contributes desktop-only helpers (SSH launch, persistence/secrets, local bootstrap info). The renderer still uses the same HTTP/WebSocket runtime path once the environment exists.

## Current Howcode shape

Howcode currently has a renderer-facing `window.piDesktop` API backed by Electron IPC:

- preload exposes `piDesktop` from `src/electron/preload/index.ts`
- `src/electron/preload/create-desktop-api.ts` maps every method to `ipcRenderer.invoke(...)` and event subscriptions
- request/event contracts live in `shared/desktop-ipc.ts`
- Electron main registers handlers in `src/electron/main/ipc/register-desktop-ipc.ts`
- dev web uses a parallel HTTP/SSE shim in `scripts/dev-web-bridge-node.ts` and `src/app/dev-web-bridge.ts`
- runtime host already has a second IPC boundary in `desktop/runtime-host/client-bridge.ts`

This is a good starting point because Howcode already has typed request/event names, but the transport and public app API are still coupled to desktop IPC and `window.piDesktop`.

## Recommended Howcode split

### 1. Introduce a transport-neutral app bridge first

Create a shared transport contract around the existing desktop IPC maps:

```ts
export interface AppTransport {
  request<K extends DesktopRequestChannel>(
    channel: K,
    params: DesktopRequestMap[K]['params'],
  ): Promise<DesktopRequestMap[K]['response']>

  subscribe<K extends DesktopEventChannel>(
    channel: K,
    listener: (event: DesktopEventMap[K]) => void,
  ): () => void
}
```

Then make:

- Electron IPC transport: current preload `ipcRenderer.invoke/on`
- Dev web transport: current HTTP/SSE bridge
- Future server transport: HTTP/WebSocket or Effect RPC

Keep `window.piDesktop` stable by building it from an `AppTransport`. This is the lowest-risk issue #220 slice.

### 2. Define ownership before moving handlers

Classify APIs before implementing server mode:

- **Client/desktop-only:** clipboard, file picker, open external/path, save to downloads, updates, dictation capture/model install if it stays device-local.
- **Howcode server-owned:** projects, git/diff, artifacts, terminal sessions, app/workspace settings, attachment search, shell state that is not Electron-specific.
- **Pi-owned / future Pi server delegated:** agent runtime sessions, provider/runtime settings, skills, packages, model/tool execution.
- **Orchestrated/shared:** actions that combine Howcode project state with Pi runtime execution should route through an explicit delegation seam rather than importing Pi internals into the Howcode server.

### 3. Add a narrow Howcode server entrypoint

Start with Node, not Bun, to match Howcode's Electron/Node runtime constraint. Use Effect v4 where it helps most:

- `shared/app-rpc.ts` or `shared/app-transport.ts` for schemas and method names
- `src/server/index.ts` CLI/entrypoint
- `src/server/server.ts` Effect layer graph
- `src/server/handlers/*` for Howcode-owned services
- one first handler such as `getShellState`, `getProjectGitState`, or `listTerminals`

Electron main can launch/connect to this local server later. Do not migrate all `DesktopRequestMap` methods in the first PR.

### 4. Prefer environment identity over "local vs remote" conditionals

Borrow T3's `ExecutionEnvironment`/`KnownEnvironment` model. Howcode should have a current local environment first, then saved remote environments later. State should be keyed by environment when server-owned data can come from more than one backend.

### 5. Keep Pi coexistence explicit

Do not make the Howcode server the permanent owner of Pi runtime state. Add an internal `PiRuntimeGateway`/`AgentRuntimeGateway` service with two possible implementations:

- local adapter to the existing runtime host
- future remote Pi server adapter

That lets Howcode own projects, git/diff, artifacts, terminal, and app UX while Pi can later own sessions, tools, skills, packages, provider settings, and execution.

## First implementation sequence

1. #219 research/design doc: adopt this as the transport and ownership proposal.
2. #220 transport-neutral bridge: extract `AppTransport`; adapt preload and dev web bridge; no behavior change.
3. #221 standalone server skeleton: start/ready/shutdown, Effect layer graph, one Howcode-owned handler.
4. Add auth/capabilities: local bootstrap token first, then bearer/ws-token style remote auth.
5. Route terminals or git/diff through the server as the first meaningful migration.
6. Only then introduce multi-environment UI state and component registries.

## Main differences from T3

- T3 already made the server authoritative. Howcode must migrate from Electron-main-authoritative to server-authoritative incrementally.
- T3 uses Bun in places. Howcode should keep server/runtime on Node-compatible APIs because Electron packaging and ASAR constraints matter here.
- T3 can let its server own provider/runtime internals. Howcode should keep a seam for a future Pi server and avoid collapsing Pi runtime into the Howcode server.
- Howcode already has a runtime-host child-process boundary. That should become an implementation behind a gateway, not the renderer-facing transport.
