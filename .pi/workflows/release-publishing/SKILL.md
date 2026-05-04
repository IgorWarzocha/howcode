---
name: Release publishing
summary: Release Howcode without accidentally building preview artifacts on dev or duplicating release builds.
---

# Release publishing SOP

Use this whenever publishing a Howcode desktop release.

## Critical rules

- **Do release prep on `main`, not `dev`.**
- Do **not** push a version-bump commit to `dev` just to prepare a release.
- `.github/workflows/release-artifacts.yml` runs on:
  - push to `dev` = preview/dev artifacts only
  - push tag `v*` = actual release artifacts + GitHub release
- Pushing release prep to `dev` first wastes CI. The release tag rebuilds artifacts anyway.
- Always inspect `.github/workflows/release-artifacts.yml` before changing the release flow.
- Do **not** globally disable Bun/GitHub dependency caches for release builds. If install cache corruption happens, use a targeted `bun pm cache rm` retry in the install step.

## Correct order

1. Ensure working tree is clean.
2. Fetch origin and tags.
3. Check `dev` vs `main` with `git log --oneline main..dev` and `git log --oneline dev..main`.
4. Bring release changes onto `main` locally first.
5. On `main`, update root `package.json`, `packages/howcode/package.json`, and release notes/changelog.
6. Commit on `main`; let hooks run.
7. Push `main`.
8. Tag the exact `main` release commit as `vX.Y.Z`.
9. Push the tag.
10. Wait for tag-triggered release workflow.
11. Verify GitHub Release assets.
12. Tell Igor to manually publish npm from `packages/howcode`.

## npm launcher

- npm launcher package version must match root package version.
- Publish npm only after GitHub release assets exist.
