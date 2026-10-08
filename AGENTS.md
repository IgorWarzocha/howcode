## Product architecture

- Design Howcode as chat with an agent first, with a small, malleable core built around Pi Durable. Coding is an optional domain, not the core's identity.
- Prefer Howcode components and Durable tool/resource extensions for domain capabilities. Users should be able to enable coding UI and tools, choose other domain capabilities, and add their own components without changing core.
- Howcode plugins and their small host SDK live in `/home/igorw/Work/howcode-components`; consume their built installed packages, never private-source aliases. Portable Durable capabilities belong in `/home/igorw/Work/pi-durable-components`; check its existing implementation before adding one.
- Keep agent capability selection independent from UI presentation. Default-enabled tools are still extensions; do not bake fixed chat/code tool bundles into core or use plumbing work to redesign product bundles or artifact storage.
- Reuse Durable's extension machinery and Effect's infrastructure primitives. Keep domain policy out of core; introduce shared component contracts only for concrete capabilities, not a speculative framework or parallel runtime.
- Components must own their feature implementation, state, services and cleanup, not just registrations or visibility switches. Core and peer features consume explicit public contracts; removing a component from composition must not break unrelated features. Composer skill suggestions belong to core, not the skill-management UI component.
- When ownership or behavior changes, update names and remove obsolete forwarding layers in the same pass. Keep historical terminology only at explicit compatibility boundaries.

## Runtime boundaries

- Use Bun for installs and scripts; the browser app's server and backend service run under stock Node.
- Put browser/server/service API contracts in `shared/*`; do not add ad-hoc transport shims.
- Native terminal and dictation dependencies belong on the server, never in browser bundles.

## Workflow

- Git/UI SDK dependencies currently use unpublished sibling tarballs. Build/pack them in `../pi-durable-components`, copy each canonical `dist/howaboua-pi-durable-{git,ui}-0.1.0.tgz` to a filename suffixed with its first eight SHA-256 characters, then update root dependency/override references and run `bun install`. New filenames prevent Bun reusing stale same-version tarball contents. These local references are not distributable release dependencies.
- Apply the same content-hashed tarball workflow to `../howcode-components`. `package.json`'s `howcodeComponents` list and installed package metadata own plugin registration; regenerate with `bun run generate:components`, never edit `*.generated.ts`. Installing a renderer plugin requires rebuilding/restarting the app, not a second Durable package install.
- Assume the dev server is already running; do not start or restart it. Read `build/dev-server.json` for its address and exercise the app in a browser.
- Commits run `bun run ai:check`, including blocking React Doctor; keep its score at 100. Run the gate manually only when asked, when not committing, or while diagnosing a failed hook.
- Do not relax Biome or TypeScript rules merely to make checks pass; fix the code or use a narrow, justified override.
- Hardening is behaviour-preserving unless separately scoped: do not change product semantics, UI, UX, copy, layout, or interaction during structural passes.
- This architecture branch has not shipped. Replace obsolete designs cleanly; do not preserve old routes, APIs, names, or implementation shapes as compatibility contracts. Preserve actual user data where it exists, not hypothetical external consumers.

## Tests

- Do not add tests whose oracle is that a feature, action, route, bridge method, or component exists.
- Do not programmatically test UI/UX, rendered markup, layout, styling, copy, or interaction flows; exercise those in the running app with disposable workspaces.
- Do not add or retain bug-specific regression tests. Record consequential failure boundaries in the nearest owning `AGENTS.md`, explaining what needs attention when that code changes, not recounting the bug.
- Retain deterministic tests only for independently justified security, persistence, concurrency, protocol, parsing, or lifecycle contracts with a validation gap not already covered by types, another check, or practical use. Adding or changing code is not itself a reason to add tests.
- Do not test Pi SDK API shape or upstream behaviour; TypeScript is the Pi compatibility check. Test only Howcode-owned policy around Pi when it has an independent oracle.
