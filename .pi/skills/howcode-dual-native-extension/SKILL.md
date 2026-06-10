---
name: howcode-dual-native-extension
description: Deprecated. Howcode now uses regular Pi SDK extensions from Pi settings/packages; do not add Howcode-only native extension snapshots or settings. Use this only as historical context when removing old dual-native-extension code.
---

# Deprecated: Howcode dual native extensions

Howcode no longer maintains a separate “native extension” system.

Current model:
- Pi extensions are loaded through Pi settings/packages.
- Howcode renders generic Pi SDK UI primitives (`ctx.ui.select/confirm/input/editor`, `notify`, `setStatus`, `setWidget`).
- Do not add app settings toggles for extension availability.
- Do not add per-session extension snapshots.
- Do not pass bundled Howcode-only extensions to Pi TUI takeover with `--extension`.
- If Howcode ships a helper extension file, treat it as a normal Pi extension path users may add to Pi settings.

Historical code using `desktop/native-extensions`, `session_native_extensions`, or Howcode-native terminology should be removed or renamed to Pi extension terminology.
