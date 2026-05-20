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
- Before overwriting, stop the previous temp app process if the pid file exists.
- Do not delete unrelated files in `/home/igorw/Work/howcode-temp`.
- Build from the repo root with Bun: `bun run build`.
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

# Launch and record pid.
("$dest/howcode" >"$log_file" 2>&1 & echo $! > "$pid_file")
sleep 1

pid=$(cat "$pid_file")
echo "Launched $dest/howcode pid=$pid"
ps -p "$pid" -o pid,cmd --no-headers || true
echo "Log: $log_file"
tail -80 "$log_file" || true
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
