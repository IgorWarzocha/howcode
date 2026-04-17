# Changelog

## Next up

- tighten visible mock/partial status drift
- finish git + diff + review convergence
- improve terminal and execution-location UX
- keep the npm launcher and release packaging flow smooth

See `docs/roadmap.md` for the broader product direction.

## 0.1.2 - CEF renderer rollout

- ship macOS, Linux, and Windows builds with bundled CEF and default to the CEF renderer
- remove the old Linux DMABUF workaround from app startup and the npm launcher
- document the renderer change and the larger bundle-size tradeoff

## 0.1.1 - Packaging fix release

- bundle the Pi runtime into packaged desktop builds
- ship launcher archives with the real extracted app payload
- launch Linux builds with `WEBKIT_DISABLE_DMABUF_RENDERER=1` by default from the npm launcher
- document the Linux white-screen workaround for direct asset launches

## 0.1.0 - Initial release

- first public Howcode release
- desktop app packaged through Electrobun
- npm launcher package for `npx howcode` and `npm i -g howcode`
- first-run platform download + local caching flow

