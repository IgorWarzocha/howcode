# Contributing

This repository uses [Vouch](https://github.com/mitchellh/vouch) to keep issue and PR traffic human-reviewed.

Pull requests from users who are not already vouched, repository collaborators, or bots may be auto-closed. Issues are open by default, except for users who have been explicitly denounced. If a maintainer wants to trust future PRs from a user, they can comment on an issue with:

- `!vouch` — vouch for the issue author
- `!vouch @user` — vouch for a specific user
- `!denounce` / `!denounce @user` — block a user explicitly
- `!unvouch` / `!unvouch @user` — remove a vouch entry

If you use AI assistance, you are still responsible for understanding and explaining your changes. Low-effort automated issues or PRs may be closed without review.

## Issues

Use the bug or feature issue form. External issues must include:

- at least one affected operating system: Windows, macOS, or Linux
- a concrete explanation of what happened or what should be implemented
- an agent implementation prompt that is visible, scoped to this repository, and does not try to override repository, developer, or system instructions

Issue text is scanned for prompt-injection patterns, hidden Markdown/HTML, and invisible Unicode/control characters. External issues containing those patterns may be labeled and auto-closed.
