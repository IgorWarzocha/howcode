# Native terminal module

- This folder owns Howcode's built-in terminal UI boundary.
- Treat it as plugin-shaped but not dynamically pluggable yet: no disable flags, registries, or runtime loading.
- Public cross-module imports should go through `@howcode/native-terminal`.
- Keep internal terminal implementation imports relative inside this folder.

