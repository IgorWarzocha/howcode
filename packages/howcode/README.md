# howcode

Launch the Howcode desktop app from npm.

## Use

```bash
npx howcode
# or
npm i -g howcode
howcode
```

On first run, the launcher downloads the matching desktop build from GitHub Releases and caches it locally.

## Linux note

On Linux, the npm launcher sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` automatically before starting the app to avoid the common WebKit/GBM white-screen issue.

If you are launching a downloaded Linux release asset manually, use:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./howcode/bin/launcher
```

## Cache location

- macOS: `~/Library/Caches/howcode`
- Linux: `$XDG_CACHE_HOME/howcode` or `~/.cache/howcode`
- Windows: `%LOCALAPPDATA%\howcode`
