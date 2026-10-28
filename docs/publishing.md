# Publishing Howcode

The workflow is prepared, but the current source is not release-ready. Root dependencies still use sibling development tarballs. Publish compatible portable packages and Howcode components, then adopt their real registry versions and update the lockfile before releasing Howcode. Matching version numbers do not prove that an npm package contains the development tarball's changes.

See [release readiness](release-readiness.md) for the remaining adoption and practical checks. No package, tag or release was published during this preparation.

## Configure npm access

The package is `howcode`. The GitHub repository is `IgorWarzocha/howcode`, and the workflow filename is `release-artifacts.yml`.

Create the GitHub Actions environment `npm`. Restrict its deployment access to release tags and add required reviewers if publication needs approval. Choose one authentication method:

- **Trusted publishing:** configure the existing npm package's trusted publisher for organisation or user `IgorWarzocha`, repository `howcode`, workflow `release-artifacts.yml`, and environment `npm`. Enable direct publishing for this workflow. New npm trusted-publisher configurations default to staged publishing and expire after two days if not activated. The current workflow performs direct publication, not staged review.
- **Token:** add an npm publish token as the environment secret `NPM_TOKEN`. Scope it to `howcode` and grant only the publication access required by npm's package and 2FA settings. Rotate it before expiry.

Trusted publishing needs npm 11.5.1 or newer. The workflow checks this and requests `id-token: write` only in the publishing job. It passes an optional token only to the publication step. Source checkout, dependency installation and builds run without npm publishing credentials.

Check npm's [trusted-publisher instructions](https://docs.npmjs.com/trusted-publishers/) when configuring access. An empty `NPM_TOKEN` is intentional when using OIDC.

## Prepare an artefact

Run from the repository root after adopting published dependencies:

```bash
bun run release:prepare durable 0.1.73-durable.1
bun run release:prepare dev 0.1.73-dev.1
bun run release:prepare main
```

These are examples. Choose an unused version. Stable releases use `packages/howcode/package.json` exactly. Its version is independent of the root development app's version. Dev and Durable releases require an explicit version containing `-dev.` or `-durable.` respectively.

Preparation validates runtime dependency references before building. It allows ordinary npm version ranges and rejects local files, workspace references and URL references rather than substituting registry versions. It stages runtime and Vite builds in a disposable directory, leaving the running development server's build files alone. Successful output goes to `artifacts/howcode-VERSION.tgz`. An existing artefact at that path is never overwritten.

The channel-specific `pack:howcode:*` commands pack already-built output. Supply the version explicitly, for example `bun run pack:howcode:durable 0.1.73-durable.1`. Use `HOWCODE_BUILD_ROOT` and `HOWCODE_RENDERER_ROOT` for staged output. The renderer variable does not change Vite's output directory.

Manual runs of **Release artifacts** accept the channel and exact version. They build, install the package in a fresh directory and upload an Actions artefact. The installed-package check loads native dependencies, scans and compiles component utility CSS, then starts the installed server with a disposable profile and shuts it down cleanly. It does not inspect the UI. Manual runs never publish to npm or create a GitHub release. Branch pushes do not start this workflow.

`scripts/verify-installed-howcode.ts` is a CI helper for an isolated runner. It uses localhost port 5173 and disposable Howcode, home and Pi directories. Do not run it alongside the development server.

Local packing and `publish:howcode:dry-run` do not prove that dependency versions exist on npm. A successful clean installation remains a separate release requirement. Today the sibling tarball references prevent both release preparation and a fresh CI installation.

## Publish a version

1. Commit the release-ready dependency pins and lockfile. For a stable release, set `packages/howcode/package.json` to the intended version.
2. Create a version tag `vVERSION` pointing at that commit and publish its GitHub release. Mark Dev and Durable releases as prereleases. Stable releases must not be marked as prereleases. Do not use a moving channel tag.
3. Approve the `npm` environment deployment if configured. The workflow builds and verifies the package before handing the tarball to the publishing job.
4. Confirm the workflow succeeded and the exact version is available on npm. The npm tag is `latest` for stable, `dev` for Dev, and `durable` for Durable.

Publishing uses provenance and disables package lifecycle scripts. The publishing job has no source checkout or dependency install. After npm publication succeeds, the workflow attaches the same tarball to the versioned GitHub release without replacing existing assets. npm versions are immutable. If publication fails, inspect that job before retrying. If only asset attachment fails, rerun that failed job rather than republishing the version.
