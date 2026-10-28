#!/usr/bin/env bash
# Source with "install" during Builds, or "check" in an agent terminal.
set -euo pipefail

runtime_dir="$HOME/.local/share/howcode-cloud"
export PATH="$runtime_dir/node-v26.12.1/bin:$runtime_dir/bun-v1.4.4/bin:$PATH"
export HOWCODE_NODE_PATH="$runtime_dir/node-v26.12.1/bin/node"

[[ $(uname -sm) == 'Linux x86_64' ]] || { echo 'Cloud runtime requires Linux x64.' >&2; exit 1; }

if [[ ${1:-check} == install ]]; then
  (
    tmp=$(mktemp -d)
    trap 'rm -rf -- "$tmp"' EXIT
    mkdir -p "$runtime_dir"
    cd "$tmp"
    # Checksums from each exact release's official SHASUMS256.txt.
    if [[ ! -e "$runtime_dir/node-v26.12.1" ]]; then
      curl --fail --location --silent --show-error --output node.tar.xz \
        https://nodejs.org/dist/v26.12.1/node-v26.12.1-linux-x64.tar.xz
      echo '6170b2d474e1c626f43cff3adc118df9fe3b573258a4fc3d850c8dbc6b079bbd  node.tar.xz' | sha256sum --check --strict
      tar -xJf node.tar.xz
      mv node-v26.12.1-linux-x64 "$runtime_dir/node-v26.12.1"
    fi
    if [[ ! -e "$runtime_dir/bun-v1.4.4" ]]; then
      curl --fail --location --silent --show-error --output bun.zip \
        https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-linux-x64.zip
      echo 'bf8ccbfb2b0b80159e0f9a6d15c55317add8077534dbc6130a3edb52fccb395c  bun.zip' | sha256sum --check --strict
      unzip -q bun.zip
      mkdir -p bun-v1.4.4/bin
      install -m 755 bun-linux-x64/bun bun-v1.4.4/bin/bun
      ln -s bun bun-v1.4.4/bin/bunx
      mv bun-v1.4.4 "$runtime_dir/bun-v1.4.4"
    fi
  )
fi

[[ $("$HOWCODE_NODE_PATH" --version) == v26.12.1 && $("$runtime_dir/bun-v1.4.4/bin/bun" --version) == 1.4.4 ]] || {
  echo 'Cloud runtime missing or incorrect. Run bash scripts/cloud-install.sh during preparation.' >&2
  exit 1
}
