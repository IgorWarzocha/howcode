# howcode

Howcode is a desktop app for coding with Pi.

It gives you:

- threaded Pi chats tied to your projects
- a built-in terminal
- project and inbox sidebars
- git and diff workflows in the app
- local desktop performance instead of a browser tab

## Install / run

```bash
npx howcode
# or
npm i -g howcode
howcode
```

This npm package is a small launcher.

On first run, it downloads the matching desktop app for your platform from GitHub Releases and caches it locally.

## What you actually get

- macOS, Linux, and Windows desktop builds
- local cached installs after first download
- automatic Linux DMABUF workaround in the npm launcher

## Project

- App repo: https://github.com/IgorWarzocha/howcode
- Issues: https://github.com/IgorWarzocha/howcode/issues

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
