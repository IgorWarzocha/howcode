## Packaged runtime artifacts

- Packaged desktop artifacts are meant to be universal for the supported service Node range, not just the Node used by the builder.
- Keep AppImage, Windows installers, macOS zip, and launcher archives carrying the same service-native ABI bundle set.
- `build:release` / `electron-builder` should build all supported service-native ABI bundles during packaging. Do not gate this behind an optional env var unless there is also a clearly named non-universal build path.
- Service-native ABI bundles must cover every native module loaded by the stock-Node desktop service, currently `better-sqlite3` and `node-pty`.
- The root unpacked `node_modules` native files should be restored to the builder/current Node ABI after building the matrix; runtime service loading should use the ABI-specific bundle.
- Keep OS-specific native packaging behavior in `scripts/service-native/platforms/*`. Do not scatter platform branches through the release orchestration scripts.
