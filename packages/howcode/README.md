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

## Cache location

- macOS: `~/Library/Caches/howcode`
- Linux: `$XDG_CACHE_HOME/howcode` or `~/.cache/howcode`
- Windows: `%LOCALAPPDATA%\howcode`
