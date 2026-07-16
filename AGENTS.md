## Runtime boundaries

- Use Bun for installs and scripts; the shipped app runs on Electron with a backend service under stock Node.
- Put cross-runtime API contracts in `shared/*`; do not add ad-hoc renderer, Electron, or desktop-service shims.
- Keep ASAR enabled. Stock-Node code and its complete native dependency trees must remain outside it.

## Workflow

- Assume the dev app is already running; do not start it. Inspect Electron through CDP at `127.0.0.1:39217`.
- Commits run `bun run ai:check`; run it manually only when asked, when not committing, or while diagnosing a failed hook.
- Do not relax Biome or TypeScript rules merely to make checks pass; fix the code or use a narrow, justified override.
