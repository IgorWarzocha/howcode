# Release readiness

28/10/2026. Work through the cheapest complete closures first. The [Afreet comparison](afreet-parity-audit.md) and assistant-first plans describe earlier investigations, not today's outstanding work.

## Already delivered

- Assistant-first setup, resident assistants, delegation and Board coordination.
- Headless recovery, reminders, scheduled work, initiative and workspace awareness. Practical acceptance covered real agent work and recovery, not every scheduling combination.
- Component ownership cleanup, optional People and configurable skill discovery.
- Chat densities, activity labels, timers, consecutive activity grouping and styled tool results.
- Notebook retention controls, security updates and Settings organisation.

Do not reopen these as implementation projects because an older audit calls them missing.

## Finish in this order

1. Prepare reproducible component packages and GitHub publishing workflows. Publish portable dependencies before Howcode components, with the SDK before its consumers.
2. Configure publishing access and publish the required versions. GitHub release archives are not npm publications. At this check, all 25 current portable package names and all 26 Howcode component versions were absent from npm.
3. Replace Howcode's development tarballs with the published, compatible versions. Do not substitute a registry package merely because it shares a development tarball's version number.
4. Produce an explicitly versioned Howcode prerelease and install that artefact without sibling checkouts. Verify first use, an existing-profile upgrade, recovery and component changes against the packaged app.
5. Close cheap practical gaps separately. Local dictation needs a model and HTTPS or localhost before actual recording can be checked. Attachment paste, drop and download need their remaining practical coverage, not a storage redesign.

Package publication and credential configuration have not happened as part of this preparation. Keep them distinct from local pack and workflow validation.

## Publishing setup

Use a short-lived `NPM_TOKEN` for the initial unpublished component packages, then configure npm trusted publishing for later versions. Never paste tokens into chat or commit them.

- Portable packages: `pi-durable-components/docs/npm-publishing.md`. Add the bootstrap secret to repository Actions secrets. Bootstrap the existing GitHub `v0.9.0` archives without changing their bytes.
- Howcode components: `howcode-components/PUBLISHING.md`. Add the bootstrap secret to the protected `npm` environment. The build uses verified public portable archives; publication still requires those portable versions on npm. Publish the SDK before its consumers.
- Howcode itself: [Publishing Howcode](publishing.md). Configure its `npm` environment for trusted publishing or a package-scoped token. Its workflow is prepared, but source dependency adoption and clean packaged-app acceptance still follow component publication.

The sibling documentation paths above are relative to the shared `Work` directory. Workflow files must be pushed to GitHub before they can run. This preparation does not push them or configure credentials.

## Not part of this pass

Global search, webhooks, conversational voice, richer resident memory and interactive forms remain product choices. They are not automatic release requirements.

Permanent retention of original chat attachments was not requested. The accepted temporary-upload policy is separate from Notebook retention. Real OS launch configuration and the broader adaptive-initiative pause matrix still lack complete practical coverage; that is not evidence of a known implementation defect.
