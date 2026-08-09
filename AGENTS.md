## Runtime boundaries

- Use Bun for installs and scripts; the shipped app runs on Electron with a backend service under stock Node.
- Put cross-runtime API contracts in `shared/*`; do not add ad-hoc renderer, Electron, or desktop-service shims.
- Keep ASAR enabled. Stock-Node code and its complete native dependency trees must remain outside it.

## Workflow

- Assume the dev app is already running; do not start it. Inspect Electron through CDP at `127.0.0.1:39217`.
- Commits run `bun run ai:check`, including blocking React Doctor; keep its score at 100. Run the gate manually only when asked, when not committing, or while diagnosing a failed hook.
- Do not relax Biome or TypeScript rules merely to make checks pass; fix the code or use a narrow, justified override.
- Before architecture or agent-hardening work, read `docs/agent-native-hardening.md`; update its evidence and phase log when a phase completes or assumptions change.
- Hardening is behaviour-preserving unless separately scoped: do not change product semantics, UI, UX, copy, layout, or interaction during structural passes.

## Tests

- Do not add tests whose oracle is that a feature, action, route, bridge method, or component exists.
- Do not programmatically test UI/UX, rendered markup, layout, styling, copy, or interaction flows; exercise those in the running app with disposable projects.
- Keep deterministic tests for security, persistence, concurrency, protocol, parsing, lifecycle, and other narrow contracts with independent failure oracles.
