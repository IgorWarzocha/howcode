# Issue selection for howcode

Use this when the user asks what should be worked on next, says “pick an issue”, or wants backlog triage.

## Board semantics
Project: `https://github.com/users/IgorWarzocha/projects/3`

- `Ready` = the real next-work queue
- `Backlog` = valid work, but not the immediate next thing
- `In progress` = actively being implemented
- `In review` = PR/review loop ongoing
- `Done` = shipped

## Priority order
1. `P0`
2. `P1`
3. `P2`

## Type order when the user wants implementation
1. `type:bug`
2. `type:feature`
3. `type:research` only if the user explicitly asked for research
4. `type:epic` only as a backlog-management task, not as normal implementation work

## What counts as manageable now
Pick an issue when most of these are true:

- it is a leaf issue, not an epic
- it has one clear job
- it does not mix research, product discussion, and implementation in one ticket
- it has enough acceptance criteria to code against
- it does not obviously need to be split first
- it fits a single branch/PR without becoming vague or sprawling

## What to leave until later or rewrite first
Do not blindly start an issue when any of these are true:

- it is an epic with child issues available
- it is a research item and the user asked for implementation work
- it mixes multiple unrelated behaviours or surfaces
- it says “assess”, “discuss”, and “implement” all in one
- the acceptance criteria are missing and there is no obvious shippable slice
- the board says `Backlog` and there are `Ready` items available

## Selection algorithm
When the user says “pick an issue and work on it”:

1. Inspect the project board.
2. Filter to open, non-done items.
3. Prefer `Ready` over `Backlog`.
4. Within `Ready`, prefer `P0` over `P1` over `P2`.
5. Within the same priority, prefer leaf bugs/features over epics/research.
6. If several candidates remain, prefer the smallest clearly shippable one.
7. Tell the user which issue you picked and why in one or two lines.

## If nothing is clearly ready
Return a short shortlist instead of guessing. For each candidate, say:

- why it is manageable now
- what makes it smaller or safer than the others
- what is blocking the items you did not pick

## Current structural conventions
- Work child issues, not epic cards.
- Keep epics in `Backlog` unless the actual task is backlog cleanup.
- `Ready` should stay small and real. Do not dump everything there.

