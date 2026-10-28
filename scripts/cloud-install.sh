#!/usr/bin/env bash
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
repos=$(dirname -- "$root")
source "$root/scripts/cloud-runtime.sh" install

for repo in "$repos/pi-durable-components" "$repos/howcode-components" "$root"; do
  test -f "$repo/package.json" || { echo "Missing sibling checkout: $repo" >&2; exit 1; }
  printf '%s: ' "$repo"
  git -C "$repo" rev-parse HEAD
done

# Portable packages are consumed from public releases, not rebuilt from this clone.
(cd "$repos/pi-durable-components" && bun install --frozen-lockfile)
(cd "$repos/howcode-components" && bun install --frozen-lockfile && bun run pack)
cd "$root"
bun install --frozen-lockfile
bun run build
