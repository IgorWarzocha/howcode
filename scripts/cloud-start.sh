#!/usr/bin/env bash
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
source "$root/scripts/cloud-runtime.sh" check
cd "$root"
# Cursor owns the requested branch and this terminal's process lifetime.
exec bun run dev:host
