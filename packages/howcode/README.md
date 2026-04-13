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

If the Linux build hits a WebKit/GBM white-screen issue, the launcher retries with `WEBKIT_DISABLE_DMABUF_RENDERER=1` automatically.

If you are launching a downloaded Linux release asset manually, use:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./howcode/bin/launcher
```

## Cache location

- macOS: `~/Library/Caches/howcode`
- Linux: `$XDG_CACHE_HOME/howcode` or `~/.cache/howcode`
- Windows: `%LOCALAPPDATA%\howcode`
