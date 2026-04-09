# Skills Reference Guide for AI Agents

This document is a vendor neutral rewrite of a product specific skills guide. It is written for AI agents that need to design, write, test, and package skills well.

It assumes a skill format built around a single `SKILL.md` file with YAML frontmatter and optional supporting folders such as `scripts/`, `references/`, and `assets/`.

## 1. What a skill is

A skill is a portable instruction bundle that teaches an agent how to perform a repeatable task or workflow consistently.

A good skill answers six questions:

1. What problem does this skill solve?
2. When should the host agent activate it?
3. What steps should the agent follow?
4. What tools, files, or references may be used?
5. What does successful output look like?
6. How should the agent recover when something fails?

A skill is not just a prompt. It is a compact operational contract.

## 2. Why skills exist

Skills exist to reduce repeated prompting, encode best practice, and improve consistency.

Use a skill when all of the following are true:

- The task recurs.
- The workflow has recognisable steps.
- Output quality improves when the same structure is reused.
- The agent benefits from domain rules, validation, or examples.

Do not create a skill for a one off task, an empty abstraction, or a workflow that is still fundamentally unclear.

## 3. Conformance language

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used in the RFC 2119 sense.

## 4. Core design principles

### 4.1 Progressive disclosure

A skill SHOULD reveal information in layers.

- **Layer 1: frontmatter** tells the host what the skill does and when to load it.
- **Layer 2: main body** tells the agent how to execute the workflow.
- **Layer 3: linked files** hold detailed references, scripts, schemas, examples, templates, or assets.

The frontmatter must stay short and trigger focused. The body must stay operational. Dense material belongs in supporting files.

### 4.2 Explicit triggering

A skill is only useful if it loads when needed and stays quiet when irrelevant.

The description in frontmatter MUST describe:

- what the skill does
- when to use it
- trigger phrases or situations
- file types or artefacts, if relevant

Where confusion is likely, the description SHOULD also say when **not** to use the skill.

### 4.3 Composability

Multiple skills may coexist. A skill MUST NOT assume it is the only capability available.

A composable skill:

- avoids conflicting global instructions
- scopes itself to a clear domain
- does not forbid unrelated host abilities unless necessary
- can hand off to other skills cleanly

### 4.4 Portability

A skill SHOULD avoid product marketing, UI specific instructions, and vendor naming unless the skill is explicitly tied to one host or tool.

Keep the skill usable across different agent surfaces where possible.

### 4.5 Determinism where it matters

Natural language is flexible. Workflows are not.

A good skill makes critical behaviour as deterministic as possible by defining:

- preconditions
- validation rules
- step order
- stop conditions
- output contracts
- error handling

If a check can be performed by code, a script is often better than prose.

### 4.6 Low context footprint

A skill SHOULD carry the minimum amount of text required to execute well.

Keep `SKILL.md` focused on instructions. Put encyclopaedic detail in `references/` and call it only when needed.

### 4.7 Fail safe behaviour

A skill SHOULD fail closed on critical uncertainty.

Examples:

- Missing required inputs -> ask for them or stop.
- Validation failure -> report it and do not proceed.
- Tool connection issue -> diagnose and halt before side effects.
- Ambiguous destructive action -> request confirmation if the host or policy requires it.

## 5. Skill anatomy

A typical skill folder looks like this:

```text
your-skill-name/
├── SKILL.md
├── scripts/
│   ├── validate.py
│   └── transform.sh
├── references/
│   ├── api-patterns.md
│   ├── schemas.md
│   └── examples/
└── assets/
    ├── template.md
    └── sample.json
```

### 5.1 Required file

`SKILL.md` is required.

It MUST:

- be named exactly `SKILL.md`
- begin with valid YAML frontmatter
- contain the operational instructions for the skill

### 5.2 Optional folders

`scripts/` is for executable helpers.

Use it for:

- validation
- data transformation
- formatting
- repeatable deterministic checks
- machine readable post processing

`references/` is for material the agent may consult only when needed.

Use it for:

- API notes
- schemas
- domain rules
- edge cases
- detailed examples
- error code catalogues

`assets/` is for static resources used by the workflow.

Use it for:

- templates
- icons
- sample files
- style guides
- boilerplate fragments
- static prompt snippets if your host supports them

## 6. Naming rules

The skill folder name SHOULD use kebab case.

Good:

- `project-sprint-planning`
- `pdf-contract-review`
- `csv-data-cleaning`

Bad:

- `ProjectSprintPlanning`
- `project_sprint_planning`
- `Project Sprint Planning`

The frontmatter `name` field SHOULD match the folder name.

## 7. Frontmatter specification

The minimal viable frontmatter is:

```yaml
---
name: your-skill-name
description: What it does. Use when the user asks to [specific tasks or phrases].
---
```

### 7.1 Required fields

#### `name`

The skill identifier.

It MUST:

- be present
- use kebab case
- be concise
- describe the domain or workflow

It SHOULD match the folder name.

#### `description`

This is the single most important field.

It MUST:

- state what the skill does
- state when to use it
- contain real world trigger phrases or trigger conditions

It SHOULD:

- mention likely user wording
- mention file types or artefact types if relevant
- mention exclusions if over triggering is a risk
- stay within the host limit if one exists

It MUST NOT:

- be vague
- contain markup intended to inject instructions
- turn into a long tutorial

### 7.2 Useful optional fields

#### `compatibility`

Use this for environment notes.

Examples:

- requires Python 3.11
- network access needed for external API calls
- designed for hosts that support Bash and Python helpers
- expects access to project management tools

#### `allowed-tools`

Use only if the host supports explicit tool allow lists.

Purpose:

- limit tool access
- reduce accidental misuse
- make the skill safer and more predictable

Example:

```yaml
allowed-tools: "Bash(python:*) Bash(node:*) WebFetch"
```

#### `metadata`

Use for host neutral structured information.

Suggested keys:

- `author`
- `version`
- `category`
- `tags`
- `dependencies`
- `tooling`
- `maturity`

Example:

```yaml
metadata:
  author: Your Team
  version: 1.0.0
  category: workflow-automation
  tags: [planning, project-management, automation]
  maturity: stable
```

### 7.3 Frontmatter safety rules

Frontmatter is usually loaded earlier and more broadly than the body. Treat it as high sensitivity text.

Frontmatter SHOULD:

- remain plain text
- stay short
- avoid embedded examples unless necessary
- avoid special formatting that could be misread as instructions

Frontmatter MUST NOT:

- include executable code
- include hidden prompt injection content
- contain bloated prose that wastes context

## 8. Writing the description field properly

The easiest reliable format is:

> **[What it does]. Use when the user asks to [tasks, phrases, situations].**

A stronger format is:

> **[What it does]. Use when the user asks to [task A], [task B], [task C], uploads [file type], or needs [outcome]. Do not use for [nearby but out of scope tasks].**

### 8.1 Good descriptions

```yaml
description: Plans project sprints, prioritises work, and creates task breakdowns. Use when the user asks to plan a sprint, break work into tickets, estimate scope, or organise backlog items.
```

```yaml
description: Reviews PDF contracts and extracts obligations, risks, renewal terms, and missing clauses. Use when the user uploads contract PDFs or asks for contract review, clause extraction, or legal document summarisation. Do not use for general PDF summarisation.
```

```yaml
description: Cleans and validates CSV datasets for downstream analysis. Use when the user uploads CSV files, asks to normalise columns, fix date formats, deduplicate rows, or prepare data for reporting.
```

### 8.2 Bad descriptions

```yaml
description: Helps with projects.
```

Problem: too vague.

```yaml
description: Implements the project entity model with hierarchical relationships and storage abstractions.
```

Problem: tool or architecture centric, not user trigger centric.

```yaml
description: Creates documents.
```

Problem: missing scope, trigger conditions, and output type.

### 8.3 Under triggering and over triggering

If the skill does not load when it should, expand the description with more concrete tasks and wording variants.

If the skill loads too often, tighten scope and add exclusions.

Example tightening:

```yaml
description: Performs advanced statistical analysis on CSV files, including regression, clustering, and significance testing. Use when the user asks for modelling, inferential analysis, or clustering. Do not use for simple charting or spreadsheet cleanup.
```

## 9. The body of `SKILL.md`

The body is where the workflow lives.

A good body is operational, not promotional.

It SHOULD answer:

- What is the goal?
- What are the prerequisites?
- What inputs are expected?
- What exact steps should the agent perform?
- What must be validated before moving on?
- What should the output contain?
- What common failures exist and what should happen next?

### 9.1 Recommended section layout

```markdown
# Skill Title

## Purpose
## When to use
## Do not use when
## Inputs expected
## Prerequisites
## Workflow
## Validation
## Error handling
## Output contract
## Examples
## References
```

This is a recommendation, not a law. What matters is clarity.

### 9.2 What each section should contain

#### Purpose

A one paragraph summary of the skill's job.

#### When to use

A compact list of situations, user requests, or uploaded artefacts that fit.

#### Do not use when

Optional but strongly recommended when adjacent skills may overlap.

#### Inputs expected

Specify required and optional inputs.

Example:

- required: project name, target date, team members
- optional: capacity assumptions, historical velocity, labels

#### Prerequisites

Document required tools, access, or environment assumptions.

Examples:

- project tracker connection available
- Python 3 installed
- access token present in environment variables

#### Workflow

This is the core. It SHOULD use numbered steps and explicit sequencing.

Each step SHOULD define:

- the action
- the input
- the expected result
- the next branch if it fails

#### Validation

List checks that MUST pass before finalisation or side effects.

#### Error handling

List common failures, causes, and recovery actions.

#### Output contract

State exactly what the result should contain.

Examples:

- summary plus ticket list
- generated file path
- table with specified columns
- JSON matching a schema

#### Examples

Include 2 to 5 realistic examples. Examples are often the difference between a mediocre and strong skill.

#### References

Point to bundled files by exact path.

## 10. Authoring procedure for agents

When an agent is asked to create a new skill, it SHOULD follow this procedure.

### Phase 1: Confirm skill fit

A skill is appropriate when:

- the task recurs
- the workflow is multi step or rule heavy
- consistency matters
- examples or validation would materially help

If the task is too vague, the agent SHOULD reduce it to 2 or 3 concrete use cases before drafting.

### Phase 2: Define concrete use cases

For each use case, write:

- **goal**
- **trigger**
- **inputs**
- **workflow**
- **result**

Example:

- goal: plan a sprint
- trigger: user asks to plan the sprint or create tasks
- inputs: backlog items, team capacity, due date
- workflow: analyse work, prioritise, break down, create tickets
- result: a sprint plan with tickets and estimates

### Phase 3: Map the workflow

Break the task into ordered stages.

Useful stage types:

- fetch or inspect
- validate
- transform
- decide
- generate
- review
- save or publish
- confirm

A skill MUST define where the workflow stops if a stage fails.

### Phase 4: Define the output contract

Before writing instructions, define the final artefact.

Examples:

- markdown report with sections A to E
- JSON object matching schema X
- created tickets with title, estimate, owner, and link
- transformed CSV with standardised headers and a validation report

### Phase 5: Draft frontmatter

Write the `name` and `description` only after the use cases are clear.

The description MUST be trigger oriented, not architecture oriented.

### Phase 6: Draft the main body

Write concise, imperative instructions.

Prefer:

- numbered steps
- checklists
- exact file paths
- explicit conditions
- examples of good output

Avoid:

- abstract advice
- buried constraints
- decorative prose
- long justifications

### Phase 7: Add support files

Move heavy detail into:

- `references/` for static knowledge
- `scripts/` for deterministic logic
- `assets/` for templates and samples

### Phase 8: Test and tighten

Test triggering, execution, output quality, and failure handling.

Tighten the description and instructions until the skill behaves reliably.

## 11. Instruction writing rules

### 11.1 Be specific and actionable

Bad:

```markdown
Validate the data before proceeding.
```

Better:

```markdown
Before generating output, validate the input CSV.

Checks:
1. Required columns exist: `date`, `customer_id`, `amount`
2. Dates use `YYYY-MM-DD`
3. `amount` is numeric
4. Duplicate rows are flagged

If any check fails, stop and return a validation summary.
```

### 11.2 Put critical rules near the top

Do not bury the most important constraints.

Bad skills often hide essential conditions in the middle of a long narrative.

### 11.3 Separate policy from procedure

Policy answers **what must be true**.

Procedure answers **how to do it**.

Keep them distinct.

Example:

```markdown
## Validation policy
- Do not create tickets without a title and owner.
- Do not estimate work when requirements are missing.

## Procedure
1. Parse the backlog.
2. Check each item for title, owner, and acceptance criteria.
3. If any item fails validation, return a blocked-items list.
4. Only then create tickets.
```

### 11.4 Define stop conditions

A skill SHOULD say when to stop iterating.

Example:

- stop when all required sections exist and validation passes
- stop after three refinement passes if quality still does not improve
- stop immediately on connection or authentication failure

### 11.5 Define idempotence where relevant

If a workflow may be run twice, say how duplicates are handled.

Examples:

- update existing ticket if identifier matches
- do not create duplicate records
- append version suffix to generated files

### 11.6 Prefer exact references

When pointing to supporting material, use exact paths.

Good:

- `references/api-patterns.md`
- `references/examples/create-project.json`
- `assets/report-template.md`

Bad:

- the docs folder
- some example file

## 12. Scripts and executable helpers

Use scripts when prose is too loose.

A script is appropriate when you need:

- deterministic validation
- repeatable transformations
- strict parsing
- schema enforcement
- output normalisation

### 12.1 Script design rules

Scripts SHOULD:

- accept explicit arguments
- avoid interactive prompts
- return stable exit codes
- write predictable stdout
- write diagnostics to stderr when possible
- document dependencies
- behave deterministically for the same input

Scripts MUST NOT:

- hide destructive side effects
- depend on manual intervention unless clearly stated
- require undocumented environment setup

### 12.2 Script contract example

```markdown
Run `python scripts/validate.py --input <file>`.

Expected behaviour:
- exit 0: validation passed
- exit 1: validation failed
- exit 2: execution error

Expected stdout:
- machine readable JSON summary

If exit code is 1, do not proceed with generation.
```

### 12.3 When not to use scripts

Do not add a script just to make the skill look sophisticated. If plain instructions are enough, keep it simple.

## 13. References and supporting knowledge

The `references/` directory prevents `SKILL.md` from becoming bloated.

Good contents for `references/`:

- API conventions
- rate limits
- pagination rules
- schemas
- field definitions
- error recovery notes
- domain terminology
- worked examples

### 13.1 How to write references

A reference file SHOULD be factual and chunkable.

Prefer:

- one topic per file
- short sections
- headings that mirror likely questions
- examples near the relevant rule

### 13.2 What not to put in references

Do not move core workflow instructions into `references/` if the agent always needs them. Core procedure belongs in `SKILL.md`.

## 14. Assets and templates

`assets/` is useful when the output needs a stable structure.

Examples:

- report templates
- email skeletons
- JSON schemas
- markdown boilerplates
- document style templates

If the skill expects a template, state that clearly in `SKILL.md`.

## 15. High value skill patterns

These patterns recur in strong skills.

### 15.1 Sequential workflow orchestration

Use when a task must happen in a strict order.

Pattern:

1. gather inputs
2. validate
3. perform step A
4. use output of A in step B
5. validate again
6. finalise

Best for:

- onboarding
- ticket creation
- multi step setup
- provisioning workflows

### 15.2 Multi tool coordination

Use when one task spans multiple services or tools.

Pattern:

1. fetch from tool A
2. transform or map the data
3. push to tool B
4. notify via tool C
5. log or save via tool D

Requirements:

- clear phase boundaries
- explicit data handoff between tools
- rollback or recovery plan for partial failure

### 15.3 Iterative refinement

Use when quality improves through review loops.

Pattern:

1. create draft
2. validate against checklist
3. fix specific defects
4. re validate
5. stop when criteria are met

Best for:

- reports
- design outputs
- generated documentation
- code generation with lint or test loops

### 15.4 Context aware tool selection

Use when multiple tools can achieve the same outcome and the right choice depends on context.

Pattern:

1. inspect file type, size, destination, or collaboration needs
2. choose the best tool using explicit criteria
3. explain the choice if useful
4. continue with tool specific steps

### 15.5 Domain specific guardrails

Use when the skill adds specialist judgement, not just tool access.

Pattern:

1. collect facts
2. apply domain rules
3. approve, reject, or route for review
4. document the decision

Best for:

- compliance
- quality assurance
- policy checks
- financial review
- safety screening

### 15.6 Validator first pattern

Use when bad input is common.

Pattern:

1. validate before any side effects
2. summarise issues clearly
3. only continue when the input is fit

This pattern prevents the agent from doing expensive or destructive work on broken input.

### 15.7 Extract transform generate pattern

Use when the task is really a pipeline.

Pattern:

1. extract source information
2. transform to canonical form
3. generate the final artefact
4. run final checks

Best for:

- document generation
- data pipelines
- design handoff
- content repackaging

## 16. Anti patterns

### 16.1 Vague descriptions

If the description sounds like a category rather than a job, it is weak.

### 16.2 Tool centric framing

Users ask for outcomes. Many weak skills describe internal architecture instead of user intent.

### 16.3 Monolithic `SKILL.md`

If the main file becomes a giant manual, triggering and execution suffer.

### 16.4 Missing negative scope

Without exclusions, adjacent skills collide.

### 16.5 Hidden assumptions

If the skill assumes a connected service, installed runtime, or available file without saying so, it will fail unpredictably.

### 16.6 No output contract

If the skill never states what success looks like, the agent improvises.

### 16.7 No examples

Skills without examples are harder for agents to internalise.

### 16.8 Decorative prose

Do not waste context on sales language, reassurance, or motivational filler.

## 17. Testing strategy

A skill should be tested along four axes.

### 17.1 Trigger tests

Goal: verify that the skill loads when relevant and does not load when irrelevant.

Create at least three groups:

- obvious trigger cases
- paraphrased trigger cases
- non trigger cases

Example:

Should trigger:

- plan this sprint
- break this work into tickets
- organise backlog items for next week

Should not trigger:

- what is the weather
- explain recursion
- create a photo realistic image

### 17.2 Functional tests

Goal: verify the workflow works.

Test:

- happy path
- missing input path
- invalid input path
- tool failure path
- repeated run path
- unusual but valid edge case

### 17.3 Output quality tests

Goal: verify that the result is structurally correct and useful.

Check:

- required sections exist
- formatting is stable
- fields are complete
- links or file paths resolve
- created artefacts are valid

### 17.4 Efficiency tests

Goal: ensure the skill reduces friction rather than increasing it.

Compare with and without the skill:

- number of tool calls
- number of retries
- amount of context consumed
- number of user corrections

## 18. Practical testing method for agents

A strong way to build a skill is to first solve one difficult real example manually, then extract the winning pattern into a reusable skill.

This works because:

- it exposes the true edge cases
- it reveals the actual step order
- it shows what the agent needed to know
- it makes the first version grounded rather than imagined

After one hard case works, broaden the test set.

## 19. Troubleshooting

### 19.1 Skill does not load

Likely causes:

- vague description
- invalid frontmatter
- incorrect `SKILL.md` file name
- mismatched folder and skill naming

Fixes:

- make the description more trigger specific
- validate YAML syntax
- ensure `SKILL.md` is exact
- simplify the frontmatter

### 19.2 Skill loads too often

Likely causes:

- description too broad
- no negative scope
- overlap with another skill

Fixes:

- narrow the description
- add explicit exclusions
- mention exact artefacts or outputs

### 19.3 Skill loads but instructions are ignored

Likely causes:

- instructions too long
- critical rules buried
- ambiguous verbs like “handle properly” or “validate carefully”
- no explicit order

Fixes:

- tighten the body
- move critical rules to the top
- replace vague language with checklists
- add examples and output contracts

### 19.4 Tool calls fail

Likely causes:

- unavailable connection
- wrong tool names
- missing permissions
- bad assumptions about inputs

Fixes:

- document prerequisites
- verify exact tool names
- add preflight checks
- fail before side effects if the tool is unavailable

### 19.5 Output is inconsistent

Likely causes:

- weak examples
- missing validation
- unclear stop conditions
- too much room for interpretation

Fixes:

- add a validation section
- add examples of correct output
- define stop conditions
- offload critical checks to scripts

### 19.6 Context bloat or slowness

Likely causes:

- oversized `SKILL.md`
- too many always needed examples
- reference material inlined into the main file

Fixes:

- move detail to `references/`
- shrink examples to the most representative ones
- keep the main file operational only

## 20. Packaging guidance

For this skill format:

- the skill lives in a single folder
- `SKILL.md` sits at the root
- supporting material stays under that root

Keep the skill folder clean.

A separate human facing repository README may exist outside the skill folder, but the skill itself SHOULD keep agent relevant documentation in `SKILL.md` and `references/`.

## 21. Minimal skill template

```markdown
---
name: example-skill
description: Performs [specific job]. Use when the user asks to [specific tasks or phrases].
compatibility: [optional environment notes]
metadata:
  version: 0.1.0
  category: [category]
---

# Example Skill

## Purpose
Describe the job of the skill in one paragraph.

## When to use
- trigger case 1
- trigger case 2
- trigger case 3

## Do not use when
- adjacent case 1
- adjacent case 2

## Inputs expected
- required input 1
- required input 2
- optional input 3

## Prerequisites
- dependency 1
- dependency 2

## Workflow
1. Inspect the input.
2. Validate required fields.
3. Perform the core transformation or tool call.
4. Validate the result.
5. Produce the final output.

## Validation
- check 1
- check 2
- check 3

## Error handling
### Error: missing required input
Action: stop and ask for the missing input.

### Error: tool unavailable
Action: report the issue and do not continue.

## Output contract
Return:
- artefact 1
- summary 2
- machine readable result 3 if applicable

## Examples
### Example 1
User says: "[example request]"
Expected behaviour:
1. [step]
2. [step]
3. [result]

## References
- `references/[file].md`
- `assets/[template].md`
- `scripts/[script].py`
```

## 22. Robust skill template

Use this when the workflow is non trivial.

```markdown
---
name: robust-skill
description: [What it does]. Use when the user asks to [trigger A], [trigger B], [trigger C], uploads [artefact type], or needs [outcome]. Do not use for [nearby out of scope tasks].
compatibility: Requires [runtime], [network/tool access], and [specific dependencies if any].
allowed-tools: "[optional host specific allow list]"
metadata:
  author: [team]
  version: 1.0.0
  category: [domain]
  tags: [[tag-1], [tag-2], [tag-3]]
  maturity: stable
---

# Robust Skill

## Purpose
One paragraph describing the workflow and final outcome.

## Scope
### In scope
- item 1
- item 2
- item 3

### Out of scope
- item 1
- item 2

## Inputs expected
### Required
- input 1
- input 2

### Optional
- input 3
- input 4

## Prerequisites
- dependency or connection 1
- dependency or runtime 2

## Workflow
### Step 1: Inspect
- gather input facts
- identify missing data

### Step 2: Validate
- run checks
- stop if validation fails

### Step 3: Execute
- call tools or perform transformation
- record outputs needed for later steps

### Step 4: Review
- compare result against checklist
- fix defects if needed

### Step 5: Finalise
- produce final artefact
- summarise actions taken

## Validation policy
- must rule 1
- must rule 2
- must rule 3

## Iteration rules
- iterate only when a validation defect exists
- stop after [n] passes or when all checks pass

## Error handling
### Error: validation failure
Cause: [reason]
Action: [recovery]

### Error: tool failure
Cause: [reason]
Action: [recovery]

### Error: ambiguous input
Cause: [reason]
Action: [recovery]

## Output contract
The final result MUST include:
- artefact 1
- summary 2
- references or paths 3

The final result MUST NOT include:
- forbidden item 1
- forbidden item 2

## Examples
### Example 1
User says: "[request]"
Agent should:
1. [action]
2. [action]
3. [result]

### Example 2
User uploads: `[file type]`
Agent should:
1. [action]
2. [action]
3. [result]

## Supporting files
- `references/[file].md`: [purpose]
- `scripts/[file].py`: [purpose]
- `assets/[file].md`: [purpose]
```

## 23. Quick evaluation checklist

Before shipping a skill, verify all of the following.

### Structure

- folder name uses kebab case
- `SKILL.md` exists at root
- frontmatter is valid YAML
- required fields exist

### Trigger quality

- description states what the skill does
- description states when to use it
- description includes real trigger phrasing
- description is not too broad
- exclusions are added if needed

### Instruction quality

- workflow is ordered
- validation is explicit
- errors are handled
- output contract is defined
- examples are realistic
- references use exact paths

### Operational quality

- prerequisites are documented
- scripts have clear contracts
- deterministic checks use code where appropriate
- no critical assumption is left unstated

### Behaviour quality

- obvious trigger cases work
- paraphrased trigger cases work
- unrelated cases do not trigger
- invalid input is handled safely
- repeated runs do not create uncontrolled duplicates

## 24. Final advice for agent authors

When creating a skill, optimise for activation quality and execution clarity.

Most weak skills fail in one of two places:

- the description is too vague, so the skill does not activate reliably
- the body is too abstract, so the agent improvises the workflow badly

Fix those two things first.

A very good skill is usually not the longest one. It is the one with the clearest trigger boundary, the most explicit workflow, the strongest validation, and the least wasted text.
