# Cloud development

Use one saved Cursor Cloud environment with these sibling checkouts:

```text
/agent/repos/howcode
/agent/repos/howcode-components
/agent/repos/pi-durable-components
```

Origin can host the development mirrors while GitHub remains connected. Repository selection and mirroring belong in Cursor's settings, not the install script. The scripts do not change remotes, branches or credentials.

## Configure the saved environment

Multi-repo environments do not automatically read this file's neighbouring `environment.json`. A personal saved environment also takes precedence over a team environment. Select Howcode as the saved environment's **environment.json location** only when the file is available on the branch Cursor uses to configure Builds.

Currently Builds clone Howcode's default `dev` branch, while this setup lives on `durable`. Until it reaches the default branch, keep the location at **None** and use this saved **install** command:

```sh
set -eu
cd /agent/repos/howcode
git fetch origin durable
git checkout --detach FETCH_HEAD
printf 'Build bootstrap Howcode commit: '
git rev-parse HEAD
bash scripts/cloud-install.sh
```

This branch selection is for Build preparation only. Never put it in `start` or a terminal command. It does not change the repository's default branch. The other two checkouts retain the revisions Cursor cloned.

Remove the old hidden `/usr/local/lib/howcode-cloud-install.sh` command from the saved configuration. Replace the old `start` command with the finite runtime check `bash /agent/repos/howcode/scripts/cloud-runtime.sh check`. Add the terminal from `environment.json` for the server:

```json
{
  "name": "Howcode",
  "command": "bash /agent/repos/howcode/scripts/cloud-start.sh"
}
```

## Preparation and startup

The finite install script installs Node **26.12.1** and Bun **1.4.4** into `~/.local/share/howcode-cloud`, verifies the downloaded archives against pinned official release SHA-256 values, and logs all three checkout commits. The base image needs Bash, Git, curl, tar, xz, unzip and sha256sum on Linux x64. No existing system tool is patched or replaced.

Preparation installs portable dependencies for editing without rebuilding its released packages. It then installs and packs Howcode Components through its supported workflow, followed by Howcode's frozen install and build. Root dependency references must match the content-hashed tarballs that packing produces. A mismatch must be integrated in the owning repository, never fixed by rewriting manifests or renaming unrelated tarballs during install.

The terminal checks the prepared runtimes and runs `dev:host`, with stock Node selected explicitly for backend services. It preserves the feature branch Cursor selected. Builds save disk state, not processes or exported variables, so the terminal restores the runtime paths each time. If a feature branch changes dependencies, run `bash scripts/cloud-install.sh` on that branch before using the app.

Use Cursor's forwarded ports to open the app. Read `build/dev-server.json` for its actual address and access details. Keep model credentials in Cursor Secrets, never in checkout files or snapshot setup commands. Installation neither publishes packages nor calls model providers.

See Cursor's [environment setup](https://cursor.com/docs/cloud-agent/setup.md), [Build lifecycle](https://cursor.com/docs/cloud-agent/builds.md) and [public configuration schema](https://cursor.com/schemas/environment.schema.json) for configuration precedence, terminal ownership and failed-Build recovery.
