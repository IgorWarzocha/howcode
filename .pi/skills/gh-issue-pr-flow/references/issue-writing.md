# Issue writing for howcode

Use this when creating new issues, rewriting vague issues, or splitting work into epics and sub-issues.

## Labels
Every new or rewritten issue should usually get:

- one type label:
  - `type:bug`
  - `type:feature`
  - `type:research`
  - `type:epic`
- one or more area labels as appropriate
- one priority label:
  - `priority:p0`
  - `priority:p1`
  - `priority:p2`

## Project fields
- `Ready` only if this is real next work
- otherwise `Backlog`
- epics are usually `Backlog`

## Choose the right issue type

### `type:bug`
Use for broken behaviour that should be fixed.

### `type:feature`
Use for one shippable implementation slice.

### `type:research`
Use for investigation, evaluation, or decision-making with no guaranteed implementation in the same ticket.

### `type:epic`
Use only for parent issues that group child work.

## Title patterns
- Bug: `Fix <broken behavior>`
- Feature: `Add <capability>` or `Show <capability>`
- Research: `Research <question>` or `Evaluate <option>`
- Epic: `Epic: <theme>`

Keep titles outcome-first and specific.

## Body templates

### Bug
```md
## Problem
<what is broken and when>

## Scope
- <what this fix covers>
- <what related problem is explicitly out of scope if needed>

## Acceptance criteria
- <observable result 1>
- <observable result 2>
- <observable result 3>

## Original issue text
> <quoted original text if rewriting an existing issue>
```

### Feature
```md
## Goal
<what capability should exist>

## Scope
- <included work>
- <included work>

## Acceptance criteria
- <observable result 1>
- <observable result 2>
- <observable result 3>

## Original issue text
> <quoted original text if rewriting an existing issue>
```

### Research
```md
## Research question
<what needs to be evaluated>

## Deliverable
- <what the investigation must produce>
- <what decision or recommendation is expected>

## Acceptance criteria
- <decision is explicit>
- <constraints or tradeoffs are documented>

## Original issue text
> <quoted original text if rewriting an existing issue>
```

### Epic
```md
## Goal
<parent theme>

## Child issues
- [ ] #123 <child one>
- [ ] #124 <child two>

## Scope
- <what belongs under this umbrella>

## Notes
<why this is grouped>

## Original issue text
> <quoted original text if rewriting an existing issue>
```

## Preserve the original user intent
When rewriting an existing issue, always keep the original text at the bottom under:

```md
## Original issue text
> ...
```

If the original body is empty, use:

```md
## Original issue text
> _No original body._
```

## When to split instead of rewrite as one issue
Split when the original issue:

- mixes multiple surfaces or features
- mixes research with implementation
- implies a parent issue plus several leaf tasks
- would clearly produce more than one coherent PR

## House rules
- Prefer one issue = one job.
- Epics are parents, not implementation tickets.
- Acceptance criteria should describe observable behaviour, not just implementation details.
- If a ticket is only partially covered by a PR, use `Refs #n`, not `Closes #n`.
