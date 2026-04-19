// Use the rooted app height instead of viewport units here.
// In the embedded desktop webview, `100vh`/`h-screen` can come up slightly wrong
// on first paint and only settle after the first resize event, which leaves a
// white strip at the bottom and mis-sizes the workspace. `#root` already tracks
// the real content area, so `h-full` keeps the shell aligned from launch.
export const appShellRootClass =
  "relative flex h-full min-h-0 overflow-hidden bg-[color:var(--workspace)] text-[color:var(--text)]";
