# Server mode production-hardening plan

Goal: bring Howcode's server/remote behavior up to the level of T3 Code's production connection model, without copying its product shape blindly.

T3 reference clone:

- `/home/igorw/Work/howcode/Frameworks/t3-code`

Important T3 files:

- `packages/ssh/src/tunnel.ts`
- `packages/ssh/src/auth.ts`
- `packages/ssh/src/command.ts`
- `packages/ssh/src/errors.ts`
- `apps/desktop/src/ssh/DesktopSshEnvironment.ts`
- `apps/web/src/rpc/wsTransport.ts`
- `apps/web/src/rpc/protocol.ts`
- `apps/web/src/rpc/wsConnectionState.ts`
- `apps/web/src/components/WebSocketConnectionSurface.tsx`
- `apps/web/src/environments/runtime/connection.ts`
- `apps/server/src/ws.ts`
- `apps/server/src/auth/http.ts`
- `packages/contracts/src/remoteAccess.ts`

Current Howcode files:

- `server/ssh-howcode-environments.ts`
- `server/howcode-server.ts`
- `server/howcode-server-transport.ts`
- `server/server-environments.ts`
- `src/electron/main/index.ts`
- `src/electron/main/ipc/request-handlers/remote-environments.ts`
- `src/app/desktop/create-desktop-api-from-transport.ts`
- `shared/howcode-server-contracts.ts`
- `shared/howcode-server-ws.ts`
- `shared/app-transport.ts`

## Current state

We now have the right broad shape:

- desktop starts a localhost Howcode server by default
- request routing can go through local, direct remote, or SSH remote server transports
- remote project/session paths preserve environment identity better than before
- SSH remote launch is working for the validated remote case
- server source is in top-level `server/`, not buried under desktop

But the SSH and WS connection code is still prototype-grade compared with T3.

The two biggest gaps:

1. SSH lifecycle is not owned by a real manager.
2. WebSocket subscriptions do not reconnect/resubscribe robustly.

## Principles

- Server is the runtime authority. Desktop can launch it, but should not be the mental owner of server state.
- Remote means another environment connection, not random renderer conditionals.
- SSH launch must be repeatable, observable, and cleanly disposable.
- A stale remote process is a normal condition, not an exceptional mystery.
- Use Effect where it improves lifecycle, resources, typed errors, retries, and diagnostics. Do not sprinkle Effect through React just for vibes.
- Keep the current `AppTransport` facade stable while hardening the implementation under it.
- Keep Node/Electron packaging constraints in mind. T3 can use Bun more freely; Howcode must keep packaged runtime behavior solid with ASAR/unpacked deps.

## Phase 1: promote SSH into a real Effect service

Create a new SSH manager module, probably:

```text
server/ssh/ssh-environment-manager.ts
server/ssh/ssh-auth.ts
server/ssh/ssh-command.ts
server/ssh/ssh-errors.ts
server/ssh/remote-scripts.ts
server/ssh/readiness.ts
```

Model it after T3's `SshEnvironmentManager`.

Target API:

```ts
export interface SshHowcodeEnvironmentManager {
  ensureEnvironment(config: SshHowcodeEnvironmentConfig): Effect.Effect<SshHowcodeEnvironmentConnection, SshEnvironmentError, Services>
  disconnectEnvironment(config: SshHowcodeEnvironmentConfig): Effect.Effect<void, SshEnvironmentError, Services>
}
```

Implementation requirements:

- key environments by resolved SSH target, not just raw label
- keep an in-memory tunnel registry
- keep a pending-connect registry, so two concurrent requests to the same target await the same launch
- use `Scope` finalizers for tunnel/process cleanup
- preserve auth secrets only in memory
- expose one bridge for Electron main to call via `Effect.runPromise`, while the internal code stays Effect-shaped

T3 behaviors to copy:

- `pendingTunnelEntries`
- `tunnels` map
- `closeTunnelEntry`
- `cancelPendingTunnelEntry`
- scoped finalizer that kills tunnel and stops managed remote server
- typed error classes for command, launch, readiness, invalid target, auth prompt

Howcode-specific notes:

- Keep existing env-driven SSH config working during migration.
- Do not break direct remote server mode.
- Do not require password prompt UI in the first pass. Add the service seam, but it can initially be batch-mode only.

Acceptance checks:

- one SSH target only launches one tunnel when `setActiveHowcodeRemoteEnvironment` is called twice quickly
- disconnect kills the tunnel and any managed remote process owned by this connection
- stale in-memory tunnel is detected and replaced
- direct remote mode still works

## Phase 2: replace fixed remote port assumptions

T3 does not assume one remote port. It picks a remote loopback port and records it under a remote state dir.

Add a Howcode remote state dir:

```text
~/.howcode/ssh-launch/<state-key>/
  port
  pid
  managed
  server.log
  run-howcode.sh
  version
```

Add remote scripts:

- `REMOTE_PICK_PORT_SCRIPT`
- `REMOTE_WAIT_READY_SCRIPT`
- `REMOTE_RUNNER_SCRIPT`
- `REMOTE_LAUNCH_SCRIPT`
- `REMOTE_STOP_SCRIPT`
- `REMOTE_LOG_TAIL_SCRIPT`

Use a default port plus scan window, not a single hard-coded port:

```ts
DEFAULT_REMOTE_PORT = 39317
REMOTE_PORT_SCAN_WINDOW = 200
```

Remote launch should return JSON:

```json
{"remotePort":39317,"serverKind":"managed"}
```

Possible server kinds:

```ts
type RemoteServerKind = 'managed' | 'external'
```

Managed means Howcode started it and can stop it.
External means Howcode discovered a healthy server and should not kill it.

Replacement rules:

- if external server is healthy, reuse it
- if managed pid exists and readiness passes, reuse it
- if managed pid exists but runner changed, kill and restart
- if managed pid exists but readiness fails, kill and restart
- if no server exists, pick port and launch
- on launch failure, tail `server.log` into the thrown error

Howcode runner resolution should support:

1. installed `howcode` CLI
2. repo checkout at `~/howcode`
3. explicit remote command override

But the repo checkout path must not be hardcoded as the only path forever. The current fallback was fine for validation, not as the long-term model.

Acceptance checks:

- remote host with busy `39317` still connects using another port
- stale pid file does not block connection
- changed runner script forces restart of managed server
- managed disconnect stops the remote server
- external server is not killed on disconnect

## Phase 3: harden SSH tunnel creation and readiness

Current tunnel launch is too optimistic. Copy T3's tunnel posture.

Tunnel args should include:

```sh
-o ExitOnForwardFailure=yes
-o ServerAliveInterval=15
-o ServerAliveCountMax=3
-n
-N
-L 127.0.0.1:<localPort>:127.0.0.1:<remotePort>
```

Add local port reservation instead of assuming `49317`:

- reserve a free loopback port before launching the tunnel
- bind tunnel to that port
- expose `baseUrl = http://127.0.0.1:<reserved>`

Readiness should race:

- HTTP readiness over forwarded local URL
- tunnel process exit

Readiness probe behavior:

- probe path: start with `/healthz` or descriptor path
- total timeout: around 20s for tunnel, 15s for remote process
- per-probe timeout: 1s
- interval: 100ms or 250ms
- capture last probe failure

On failure, log/report:

- SSH target fields
- command args, redacted where needed
- local port
- remote port
- process running status
- whether local port is listening
- remote log tail
- last readiness cause

Acceptance checks:

- bad host gives clear SSH command error
- remote server crash gives remote log tail
- local port conflict is handled by picking a different port
- tunnel process exiting during readiness fails immediately

## Phase 4: make server transport resilient

`server/howcode-server-transport.ts` currently opens one WebSocket per subscription and does not reconnect/resubscribe. This is not enough.

Introduce a resilient transport under the same `AppTransport` interface:

```text
server/howcode-server-resilient-transport.ts
```

Features:

- connection status object
- request retry only for connection-ish failures, not all errors
- WS reconnect with exponential backoff
- subscription registry
- automatic resubscribe after reconnect
- manual reconnect method for Electron main/UI
- dispose method for cleanup
- slow request tracking hooks later

T3 concepts to copy:

- `WsConnectionStatus`
- reconnect phase: `idle | attempting | waiting | exhausted`
- attempt counts
- `nextRetryAt`
- intentional vs unintentional close
- `hasConnected`
- subscription `onResubscribe`
- heartbeat freshness

Howcode can keep HTTP POST for requests for now. Do not jump to full Effect RPC until the connection lifecycle is solid.

Acceptance checks:

- kill SSH tunnel; UI/server state moves to reconnecting or disconnected
- restore tunnel/server; subscriptions resume without reopening the app
- terminal events resume after reconnect
- desktop events resume after reconnect
- request retry does not duplicate non-idempotent actions blindly

## Phase 5: expose connection status to app state

Right now we have `HowcodeServerConnectionState`, but it is not as rich as T3's connection state.

Extend shared contracts with fields like:

```ts
type ConnectionPhase = 'idle' | 'connecting' | 'connected' | 'disconnected'
type ReconnectPhase = 'idle' | 'attempting' | 'waiting' | 'exhausted'
```

Track:

- phase
- reconnectPhase
- attemptCount
- reconnectAttemptCount
- connectedAt
- disconnectedAt
- lastError
- lastErrorAt
- nextRetryAt
- closeCode / closeReason for WS
- active environment id
- server kind: local, direct, ssh-managed, ssh-external
- version/build fingerprint once available

Add a small UI surface later. First make the state inspectable through existing server-state calls/events.

Acceptance checks:

- remote connection failure explains whether it is auth, SSH, tunnel, readiness, or app server
- reconnect attempts are visible programmatically
- stale reconnect does not spin forever without user-visible state

## Phase 6: add version/fingerprint checks

We already hit stale remote server reuse. This needs a first-class fix.

Add to descriptor or manifest:

- server protocol version
- app version or git commit if available
- build timestamp or package version
- runtime kind: desktop-local, standalone, packaged, repo-dev
- capabilities list

On SSH managed launch:

- write expected runner fingerprint into remote state dir
- compare with current remote state
- restart managed server if fingerprint changed

On client connect:

- reject or warn on incompatible protocol version
- show useful error instead of silent weirdness

Acceptance checks:

- after changing local server code, managed SSH server restarts instead of reusing stale process
- direct remote with incompatible version reports a clear error

## Phase 7: improve auth, but after lifecycle

T3 has a much stronger auth model:

- one-time pairing credentials
- bootstrap exchange
- bearer sessions
- WS-specific tokens
- owner/client roles
- revocation
- active clients

Howcode does not need all of this before SSH lifecycle is solid.

Minimum near-term hardening:

- keep static bearer token for local/SSH tunnel
- never log full tokens
- use constant-time compare everywhere we compare secrets
- reject empty token in exposed/direct mode
- require token for WS and HTTP requests
- validate SSH forwarded URLs are loopback when environment kind is SSH

Later:

- pairing token endpoint for direct remote setup
- persisted client sessions for remote browser clients
- WS short-lived token exchange
- owner/client roles if we expose network access beyond SSH tunnels

Acceptance checks:

- SSH bridge refuses non-loopback base URL
- direct server mode refuses missing token when host is not loopback
- logs redact auth material

## Phase 8: optional Effect RPC migration

Do not block the SSH hardening on this.

T3's full model is Effect RPC over WebSocket. That gives typed RPC, streaming, protocol retries, request hooks, and less ad-hoc event plumbing.

For Howcode, a safe path is:

1. Keep `AppTransport` public.
2. Add Effect services behind server handlers.
3. Move HTTP request dispatch and WS events to schema-validated contracts.
4. Only then consider replacing HTTP POST + WS events with Effect RPC.

Potential target:

```text
shared/howcode-rpc.ts
server/rpc-server.ts
src/app/desktop/effect-rpc-transport.ts
```

But this is a later refactor. The immediate pain is lifecycle/reconnect, not transport fashion.

## Test plan

Unit tests:

- remote script generation
- port parsing and state key generation
- launch result decoding, including pretty JSON
- readiness timeout and last-cause capture
- stale tunnel replacement
- pending ensure dedupe
- managed vs external disconnect behavior
- WS reconnect state transitions
- subscription resubscribe behavior

Integration-ish tests:

- local server starts on `127.0.0.1:0`
- standalone server responds to `/healthz`, descriptor, authenticated manifest
- SSH manager with fake spawner verifies command args and cleanup
- server transport reconnects with mocked WebSocket/fetch

Manual/programmatic validation:

- local packaged/dev launch starts localhost server
- direct remote server connect with token
- SSH remote to `howaclawa@192.168.0.113`
- project `/home/howaclawa/openbrain`
- prompt: `what is this project`
- verify agent uses shell/tools remotely
- kill tunnel/server mid-session and verify reconnect/resubscribe
- change code/build fingerprint and verify managed remote restart

Required repo check after each implementation slice:

```sh
bun run ai:check
```

## Suggested issue split

1. SSH manager skeleton with Effect service, typed errors, scoped cleanup.
2. Remote launch scripts with state dir, dynamic remote port, managed/external ownership.
3. Tunnel readiness and diagnostics, including log tail and keepalive options.
4. Resilient server transport with WS reconnect/resubscribe.
5. Connection status contract and UI/state exposure.
6. Server fingerprint/capability checks and managed restart policy.
7. Auth hardening: loopback validation, token redaction, non-loopback token requirements.
8. Optional Effect RPC design spike.

## Biggest risks

- Accidentally killing an external server that we do not own.
- Retrying non-idempotent actions and duplicating sends.
- Making SSH password/auth flows worse by forcing BatchMode everywhere.
- Adding Effect abstractions without improving lifecycle or diagnostics.
- Forgetting ASAR/unpacked packaging constraints for standalone server dependencies.

## Definition of done

We are T3-like enough when this is true:

- SSH connection lifecycle is a managed resource with ownership and cleanup.
- Stale remote server reuse is detected and fixed automatically.
- Remote ports are dynamic and conflict-safe.
- Tunnel readiness is probed through the actual forwarded URL.
- WS subscriptions reconnect and resubscribe.
- The UI/API can explain connection state without guessing.
- Programmatic remote agent calls keep working after reconnect and still execute tools on the remote host.
