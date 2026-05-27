# Terminal support

Howcode's built-in terminal is an embedded xterm.js terminal backed by node-pty. It is meant to run Pi sessions and ordinary shells inside the app, not to fully emulate every native terminal app.

## Supported

- ANSI escape sequences through xterm.js.
- 256-color output via `TERM=xterm-256color`.
- Truecolor hints via `COLORTERM=truecolor`.
- Unicode text and emoji when the OS/font stack can render them.
- Nerd Font glyphs when a compatible font is installed. The renderer prefers common Nerd Font families before falling back to platform monospace fonts.
- Clickable HTTP/HTTPS links.
- Shell sessions and Pi session takeover sessions.

## Not supported

- Terminal-specific integrations from Ghostty, Kitty, iTerm2, WezTerm, etc.
- Image protocols and graphics protocols such as Kitty graphics, iTerm inline images, and Sixel.
- Terminal app identity/proprietary feature detection. Pi sessions scrub host-terminal capability variables and expose `TERM_PROGRAM=howcode` instead.
- Font bundling. If a prompt theme depends on Nerd Font symbols, the user still needs a Nerd Font installed on the system.
- Perfect native-terminal parity for every shell prompt/theme.

## Environment contract

For embedded Pi sessions, Howcode advertises the portable baseline:

- `TERM=xterm-256color`
- `COLORTERM=truecolor`
- `TERM_PROGRAM=howcode`
- `HOWCODE_EMBEDDED_TERMINAL=1`
- `HOWCODE_TERMINAL_CAPABILITIES=ansi,256color,truecolor,unicode,no-terminal-protocols`

Host-specific variables such as `KITTY_WINDOW_ID`, `WEZTERM_PANE`, `ITERM_SESSION_ID`, `GHOSTTY_RESOURCES_DIR`, and inherited `TERM_PROGRAM` are removed for Pi sessions so CLI tools do not incorrectly assume a native terminal integration is available.
