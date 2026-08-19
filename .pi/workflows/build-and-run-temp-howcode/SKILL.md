---
name: "Build and run temp Howcode"
description: "Use when Igor asks to build this branch/current repo and run a disposable build version"
---

# Build and run temp Howcode

Use this when Igor asks to build the current branch/current repo and run a disposable Howcode app from `/home/igorw/Work/howcode-temp`.

Trigger phrases include:

- "build this and run it for me"
- "put it in howcode-temp"
- "overwrite the old temp build"
- "launch the current branch"
- "make me a temp Howcode build"

## Rules

- Keep only one temp app copy: `/home/igorw/Work/howcode-temp/howcode-fixed`.
- Reuse one pid/log pair:
  - `/home/igorw/Work/howcode-temp/howcode-fixed.pid`
  - `/home/igorw/Work/howcode-temp/howcode-fixed.log`
- Keep Electron and desktop-service state isolated in `/home/igorw/Work/howcode-temp/howcode-fixed-data`; pass both `HOWCODE_USER_DATA_PATH` and Electron's early `--user-data-dir` argument.
- Before overwriting, stop the previous temp app process if the pid file exists.
- Do not delete unrelated files in `/home/igorw/Work/howcode-temp`.
- Build from the repo root with Bun: `bun run build`.
- Build and launch must run from a detached background shell. Do **not** run the long build in the agent tool session, tmux, or Igor's terminal. Start it with `setsid ... &`, write a runner pid/log, then poll the log/pid from the agent.
- Always export explicit service Node paths before building, because package builds need all supported stock Node ABIs and non-login shells may not resolve `mise which node@24`:
  - `HOWCODE_NODE_24_PATH=/home/igorw/.local/share/mise/installs/node/24.18.0/bin/node`
  - `HOWCODE_NODE_25_PATH=/home/igorw/.local/share/mise/installs/node/25.9.0/bin/node`
  - `HOWCODE_NODE_26_PATH=/home/igorw/.local/share/mise/installs/node/26.2.0/bin/node`
- For code changes, run/verify `bun run ai:check` before this workflow or rely on commit hooks if the change was just committed.

## Procedure

```bash
set -euo pipefail

repo=/home/igorw/Work/howcode
temp_root=/home/igorw/Work/howcode-temp
app_name=howcode-fixed
src="$repo/artifacts/electron/linux-unpacked"
dest="$temp_root/$app_name"
pid_file="$temp_root/$app_name.pid"
log_file="$temp_root/$app_name.log"
runner_pid_file="$temp_root/$app_name.runner.pid"
runner_log_file="$temp_root/$app_name.runner.log"

cat > "$temp_root/run-$app_name.sh" <<'RUNNER'
#!/usr/bin/env bash
set -euo pipefail

repo=/home/igorw/Work/howcode
temp_root=/home/igorw/Work/howcode-temp
app_name=howcode-fixed
src="$repo/artifacts/electron/linux-unpacked"
dest="$temp_root/$app_name"
pid_file="$temp_root/$app_name.pid"
log_file="$temp_root/$app_name.log"
user_data_path="$temp_root/$app_name-data"

export HOWCODE_NODE_24_PATH=/home/igorw/.local/share/mise/installs/node/24.18.0/bin/node
export HOWCODE_NODE_25_PATH=/home/igorw/.local/share/mise/installs/node/25.9.0/bin/node
export HOWCODE_NODE_26_PATH=/home/igorw/.local/share/mise/installs/node/26.2.0/bin/node

cd "$repo"

# Stop prior temp launch, if still running.
if [ -f "$pid_file" ]; then
  old_pid=$(cat "$pid_file")
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    kill "$old_pid" 2>/dev/null || true
  fi
fi

# Build current checkout.
bun run build

# Overwrite the single temp copy; do not accumulate versions.
mkdir -p "$temp_root"
rm -rf "$dest"
cp -a "$src" "$dest"

# Replace the launch log for this run.
: > "$log_file"
mkdir -p "$user_data_path"

# Launch fully detached from the agent shell/session and record pid.
setsid -f env HOWCODE_USER_DATA_PATH="$user_data_path" \
  "$dest/howcode" "--user-data-dir=$user_data_path" >"$log_file" 2>&1
sleep 1

pid=$(pgrep -f "^$dest/howcode" | head -n1 || true)
if [ -z "$pid" ]; then
  echo "Launch did not stay up; log follows:" >&2
  tail -80 "$log_file" >&2 || true
  exit 1
fi
echo "$pid" > "$pid_file"
echo "Launched $dest/howcode pid=$pid"
ps -p "$pid" -o pid,ppid,sid,cmd --no-headers || true
echo "Log: $log_file"
tail -80 "$log_file" || true
RUNNER

chmod +x "$temp_root/run-$app_name.sh"

# Run the whole build+copy+launch workflow detached from the agent/tmux terminal.
: > "$runner_log_file"
setsid -f "$temp_root/run-$app_name.sh" >"$runner_log_file" 2>&1
sleep 1

runner_pid=$(pgrep -f "^bash $temp_root/run-$app_name.sh" | head -n1 || true)
if [ -n "$runner_pid" ]; then
  echo "$runner_pid" > "$runner_pid_file"
  echo "Detached temp build runner pid=$runner_pid"
else
  echo "Detached runner finished quickly; check log: $runner_log_file"
fi
tail -80 "$runner_log_file" || true
```

Poll until done:

```bash
tail -120 /home/igorw/Work/howcode-temp/howcode-fixed.runner.log
runner_pid=$(cat /home/igorw/Work/howcode-temp/howcode-fixed.runner.pid 2>/dev/null || true)
if [ -n "$runner_pid" ] && kill -0 "$runner_pid" 2>/dev/null; then
  echo "Still building/running: $runner_pid"
else
  echo "Runner finished"
  tail -120 /home/igorw/Work/howcode-temp/howcode-fixed.runner.log
fi
```

## If the app freezes/crashes

Check the temp launch log first:

```bash
tail -200 /home/igorw/Work/howcode-temp/howcode-fixed.log
```

Then check coredumps/journal for the recorded pid:

```bash
pid=$(cat /home/igorw/Work/howcode-temp/howcode-fixed.pid)
coredumpctl info "$pid" --no-pager || true
journalctl --user --since '20 minutes ago' --no-pager | rg -i 'howcode|electron|gpu|renderer|crash|segfault|oom|killed' || true
```

If Chromium reports `GPU process isn't usable`, try a diagnostic relaunch with GPU disabled:

```bash
/home/igorw/Work/howcode-temp/howcode-fixed/howcode --disable-gpu
```
