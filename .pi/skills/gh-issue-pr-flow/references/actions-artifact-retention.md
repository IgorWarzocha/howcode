# GitHub Actions artifact retention for this repo

Use this when PR or release work touches `.github/workflows/*`, release packaging, or GitHub Actions artifact policy.

## Repo policy
- This repo is public, so standard hosted-runner build minutes are not the main concern.
- Artifact storage is the thing to control.
- PRs should validate packaging, but should not retain heavyweight build artifacts by default.
- `dev` should keep only the latest dev artifact set.
- Tagged releases should still publish proper release assets.

## Current expected workflow shape
- `pull_request` to `dev`: run the build matrix for validation only; do not upload release artifacts.
- `push` to `dev`: upload dev artifacts with short retention.
- `workflow_dispatch`: optional preview artifacts with short retention.
- `push` tags `v*`: upload release artifacts and publish the GitHub release.

## Retention rules
- Use `retention-days: 1` for non-release artifacts unless the user explicitly asks otherwise.
- Keep a cleanup step/job that deletes artifacts from older `dev` runs so only the newest `dev` artifact set remains.
- Prefer `concurrency` with `cancel-in-progress: true` for heavy packaging workflows so superseded runs do not keep burning storage.

## Things to avoid
- Do not upload the full cross-platform artifact matrix for every PR unless the user explicitly wants stored PR artifacts.
- Do not leave long-lived preview or dev artifacts around by accident.
- Do not change artifact naming or triggers casually if that would break the cleanup job's assumptions.

## Validation checklist for workflow changes
Before merging workflow changes, confirm:

1. PR builds still exercise the packaging path if that validation matters.
2. PR runs do not upload heavyweight artifacts unless explicitly intended.
3. `dev` uploads still happen only on `push` to `dev`.
4. `dev` artifacts use short retention.
5. Older `dev` artifacts are cleaned up automatically.
6. Tagged releases still upload/publish the expected release assets.

## Current repo implementation snapshot
At the time this reference was added:

- `release-artifacts.yml` runs on PRs to `dev`, pushes to `dev`, pushes of tags `v*`, and `workflow_dispatch`.
- PR runs build only.
- `dev` runs upload `dev-*` artifacts with one-day retention.
- `workflow_dispatch` runs upload `preview-*` artifacts with one-day retention.
- Tag runs upload `release-*` artifacts and publish the GitHub release.
- A cleanup job deletes artifacts from older `dev` runs.

Update this reference if the repo intentionally changes its Actions storage policy.
