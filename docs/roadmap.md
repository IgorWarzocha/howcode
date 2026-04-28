## Coming ASAP
- More cards.
- Worktrees.
- Automations per project.
- Multiple terminals per session.
- External terminal control for agents, probably via a small tool.
- Probably some tweaks around the sidebar.
- Background-mode, the minute we get a Pi server.
- Remote sessions via SSH. Unsure how. Could depend on Pi server.
- Better responsive UI.

## Coming Soon™
- Chat: Websearch. Artifacts. With an option to hand off to other views.
- Claw: a version of Openclaw. Your sidekick for managing everything in the app.
- Work: office-docs oriented view.
- Above views will have minimal extensions running by default and their own workspaces.

## Pi extension compatibility notes
- Extension `/commands` should work like Pi: list them, send them, and show whatever they emit.
- `select`: extension asks the user to pick one option from a list. Needs a Howcode-native picker.
- `input`: extension asks the user to type a short answer. Needs a small Howcode-native prompt.
- `custom`: extension brings its own interactive UI. This is the awkward one; probably needs a proper extension UI host, not a fake dialog.
- Until those UI bits exist, headless commands should still run and show messages, but fancy TUI-first commands may degrade.

Submit any ideas or suggestions to https://github.com/IgorWarzocha/howcode/issues

Snapshot: April 27, 2026.
