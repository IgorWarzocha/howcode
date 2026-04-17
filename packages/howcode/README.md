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
- desktop builds that bundle CEF for a more consistent renderer

## Project

- App repo: https://github.com/IgorWarzocha/howcode
- Issues: https://github.com/IgorWarzocha/howcode/issues

## Renderer note

Release builds now bundle CEF on macOS, Linux, and Windows. The launcher no longer needs to inject the old Linux `WEBKIT_DISABLE_DMABUF_RENDERER` workaround.

Expect downloads to be larger than the native-webview builds in exchange for more consistent rendering behavior.

## Cache location

- macOS: `~/Library/Caches/howcode`
- Linux: `$XDG_CACHE_HOME/howcode` or `~/.cache/howcode`
- Windows: `%LOCALAPPDATA%\howcode`
