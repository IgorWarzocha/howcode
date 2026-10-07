## Product architecture

- Design Howcode as chat with an agent first, with a small, malleable core built around Pi Durable. Coding is an optional domain, not the core's identity.
- Prefer Howcode UI extensions and Durable tool/resource extensions for domain capabilities. Users should be able to enable coding UI and tools, choose other domain capabilities, and add their own UI extensions without changing core.
- Reuse Durable's extension machinery and Effect's infrastructure primitives. Keep domain policy out of core; introduce shared extension contracts only for concrete capabilities, not a speculative framework or parallel runtime.

## Runtime boundaries

- Use Bun for installs and scripts; the browser app's server and backend service run under stock Node.
- Put browser/server/service API contracts in `shared/*`; do not add ad-hoc transport shims.
- Native terminal and dictation dependencies belong on the server, never in browser bundles.

## Workflow

- Assume the dev server is already running; do not start or restart it. Read `build/dev-server.json` for its address and exercise the app in a browser.
- Commits run `bun run ai:check`, including blocking React Doctor; keep its score at 100. Run the gate manually only when asked, when not committing, or while diagnosing a failed hook.
- Do not relax Biome or TypeScript rules merely to make checks pass; fix the code or use a narrow, justified override.
- Hardening is behaviour-preserving unless separately scoped: do not change product semantics, UI, UX, copy, layout, or interaction during structural passes.

## Tests

- Do not add tests whose oracle is that a feature, action, route, bridge method, or component exists.
- Do not programmatically test UI/UX, rendered markup, layout, styling, copy, or interaction flows; exercise those in the running app with disposable projects.
- If a regression is immediately obvious by launching the app or trying the workflow, use that practical check instead of a happy-path unit or integration test.
- Keep deterministic tests for security, persistence, concurrency, protocol, parsing, lifecycle, and other narrow contracts with independent failure oracles.
- Do not test Pi SDK API shape or upstream behaviour; TypeScript is the Pi compatibility check. Test only Howcode-owned policy around Pi when it has an independent oracle.
