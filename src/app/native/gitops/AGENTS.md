# Native GitOps module

- This folder owns Howcode's built-in GitOps boundary: diff UI, review/comment state, branch/baseline controls, and GitOps composer surfaces.
- Treat it as plugin-shaped but not dynamically pluggable yet: no disable flags, registries, or runtime loading until the app shell has a deliberate contribution API.
- Public cross-module imports should go through `@howcode/native-gitops`.
- Keep internal GitOps implementation imports relative inside this folder.
- Generic composer primitives may be imported from `@howcode/composer`; do not move non-Git composer behavior here.
