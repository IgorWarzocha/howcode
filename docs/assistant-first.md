# Assistant-first Howcode

The planning questions are resolved. Product direction and the decisions below are agreed. Workboard boundaries are proposals, not implementation approval.

[The implementation companion](assistant-first-implementation.md) maps the source-backed changes, ownership, dependencies and validation work.

## Goal

Howcode starts with you and your main assistant. It remains available without an open browser, notices where attention might help and shapes its working environment with you. Manual sessions remain available, but do not organise the product.

## Agreed decisions

### Feature boundaries

- Build agent access into each feature's supported operations. The UI, agent tools and MCP should use the same feature-owned behaviour, not separate connector implementations.
- Reuse small agent primitives where requirements actually repeat. Scheduled initiative and continuing after component activation should share reliable subscription and delivery machinery, rather than each inventing a wake-up mechanism.
- Keep passive notification, new work and continuation of accepted work distinct. Sharing delivery machinery does not make every event wake an agent.
- Expose deliberate capabilities and outcomes. Keep implementation details replaceable without hiding failures, provenance or useful inspection. Features should be easy to add and remove while preserving actual user data.
- Treat temporary prompting and model-behaviour workarounds as removable. Reliable execution, recovery and user-selected policy remain application responsibilities.

### First delivery and setup

- Deliver reliable runtime behaviour first. Proactive discovery and autonomous task completion are later milestones.
- The first delivery must cover fresh installations, not just Igor's configured development profile.
- The user chooses the main assistant's backing folder. Do not silently assign its home to the app directory or a hidden profile folder.
- After model setup, go straight into conversation with a default identity and prepared capabilities. Do not require naming or detailed instruction setup before meeting the assistant.
- Include setup for both manual launch and unattended operation, including automatic restart and boot startup where selected.
- Let the main assistant configure the user's actual OS and environment through available tools. Do not build a platform-specific service-management framework merely to cover every environment.
- Keep one canonical `Howcode setup` thread on the main assistant's Board. Record decisions, actual operating conditions and completed configuration there, including installed or generated views. Reuse Board rather than creating a separate setup-record feature. The assistant can consult and update this thread when changing or undoing setup.
- The wizard collects model access, home folder, launch preference and initiative mode. The assistant then implements and verifies that configuration in conversation.
- If the chosen unattended setup cannot be established, setup remains incomplete. Surface the blocker and required user action rather than silently substituting a weaker launch mode.
- Process uptime and initiative are separate choices. Support conversational sidequests, fixed proactive intervals and adaptive initiative, independently of manual launch or boot startup.
- Conversational sidequests are not tied to browser presence. The assistant may follow related work after the user leaves and judges when to wind down.
- Proactive work follows the user's standing instructions. Do not introduce a separate blanket approval policy for unsolicited work.
- Reliable startup and recovery are application responsibilities. Do not give the assistant a recurring end-to-end test ritual or synthetic verification job on wake. Implementation validation is developer work, separate from ordinary assistant behaviour.

### Adaptive initiative

- Reduce or suspend generic proactive check-ins while the user is active. Give agents more opportunity to work during the user's absence, not more reasons to interrupt an already busy user.
- Use genuine user-prompt activity and rolling weekly/monthly patterns, not browser presence, agent messages or raw prompt volume alone. Activity elsewhere in the app still means the user is around.
- Give the agent a tool to adjust its next internal check-in. The system applies activity-based suppression and user preferences over that request. The agent may wait longer, but cannot shorten the user's configured minimum gap or override snooze, halt or workspace policy.
- Keep timers and learned activity patterns internal. Do not add a timer dashboard, routine countdowns or explanations of each timing adjustment to ordinary chat. Expose useful timing preferences in Settings.

| Level | Default minimum gap between generic check-ins |
| --- | --- |
| Off | No generic proactive check-ins |
| Low | 2 hours |
| Normal | 1 hour |
| High | 30 minutes |

- Make all three intervals editable, along with the quiet period after a user prompt, initially 30 minutes. Longer settings such as 8 hours, 4 hours and 2 hours are valid. These are maximum frequencies, not a requirement to wake at every opportunity.
- Do not start another generic check-in while that resident is already working. Already accepted work continues, including when activity suppresses new check-ins.
- A Pulse admitted to run counts as proactive activity for its workspace and suppresses or postpones a redundant generic check-in. Other proactive event-triggered work should receive the same credit. Merely defining a future schedule does not count.
- Deduplicate per scope through shared admission and activity accounting, not a separate dedupe service. Explicitly scheduled jobs and reminders retain their own timing, subject to explicit snooze and halt. Generic check-in suppression must not cancel those jobs or merge distinct tasks.

### Residents, context and Boards

- The main assistant works within its own workspace. For work elsewhere, it talks to workspace bots or starts threads rather than carrying out those tasks itself.
- Workspace residents are optional. A workspace listing names its bot or explicitly says there is no bot. Create a persistent resident only when the user wants one, not automatically on discovery, workspace creation or upgrade.
- A workspace without a resident remains a classic workspace with manually created chats. The main assistant may maintain a top-level Board thread and ask how things are going, subject to its policy, but must not take over its work. If the user asks it to start a task there, create a normal chat rather than manufacturing a persistent bot.
- Workspace bots own local judgement: existing changes, competing work, worktree conventions, blockers and whether anything needs doing at all.
- Each workspace resident anchors one continuing conversation family. Its workers and Board remain with that family. Context rollover must not manufacture a new resident family or Board.
- The main assistant has its own context and top-level Board. Workspace residents retain local context and share it with their workers. Do not collapse all residents into the main assistant's family to obtain shared Board access.
- Workers can create and contribute to local Board threads. The workspace resident can create, close and reopen its local threads.
- Workspace residents can create top-level threads and publish high-level overviews to the main assistant's Board. Link the underlying local work rather than copying all of its context into the main assistant.
- The main assistant can create a top-level thread for a workspace resident. A Board notification does not wake an idle resident. Urgent work requires an explicit message. Otherwise the resident picks up relevant updates on its next wake.
- Context sharing, Board participation and turn-start are separate contracts. Preserve that distinction in tools and presentation.
- In a workspace with a resident, manually opened chats are workspace-family threads with their own conversation context and shared Board participation. Resident-free workspaces retain ordinary chats without creating a resident merely to host them.
- When Board is active, standing instructions should encourage documenting useful work and decisions there. Allow deliberate lookup of other agents' Notes where appropriate, including by the main assistant, but do not make cross-agent Notes reading or wholesale context sharing the default.

### Workspace awareness and folder intent

- The main assistant needs a cross-workspace progress surface when deciding what to do. Older untouched work gets attention first, subject to context. It should adapt to the user, not apply a rigid inactivity rule.
- Track last user message separately from last Howcode activity. Show Git progress separately too. Fresh bot activity must not conceal a long absence of user attention or work waiting for review.
- Discover projects within user-chosen parent folders and propose new workspaces for enrolment. Do not automatically enrol every discovered folder.
- Roots carry user-described roles and priorities, not just filesystem paths. Examples include active coding work, low-priority reference repositories, life-admin documents and a main-job folder requiring extra care.
- Users can mark nested folders off limits or observation-only for the main assistant. Observation-only workspaces can provide current information, but the main assistant must not suggest or initiate extra work there. The user may still initiate work directly in those workspaces.
- Start with standing instructions and informative tool output for those policies, not a new permission or isolation framework. Workspace listings must show the policy and short, agent-maintainable comments that remind the main assistant of the workspace's basics.
- Expose that overview through a workspace-listing tool used when needed. Do not inject a workspace report into every turn.
- Doing nothing can be the right decision. A stale thread is a reason to ask the resident about blockers, not an automatic order to start a worker.

### Snooze, pause and reminders

- When asked to leave work alone temporarily, finish already accepted work and its reporting, but do not initiate unrelated work. Explicit task cancellation remains separate.
- Give the main assistant a tool that presents a scoped snooze card. Choices include tomorrow morning, evening, a number of hours or a number of days.
- Use the server's local timezone, with morning at 09:00 and evening at 18:00. Show the resolved date, time and timezone on the card.
- Snooze targets one workspace or the main assistant's own scope, never the entire app through that scoped tool. It suspends proactive admission from Pulses and comparable scheduled components for that target.
- On reactivation, coalesce missed occurrences into one fresh run per distinct job and queue the different jobs. Programmatically include how many occurrences were missed and the start and end of the missed period, instructing the run to cover relevant work since then. Clearly obsolete or expired jobs should be reported rather than blindly replayed.
- Pace catch-up with a configurable small concurrency limit. Let the user or assistant adjust it, and honour provider backoff when limits are hit. Do not introduce a billing system or pretend the concurrency setting knows every provider's limits.
- Distinguish an indefinite global halt from a timed snooze. After a global halt, each workspace, including the main assistant's own scope, requires individual resume. New workspaces start paused under that halt. Snooze timers cannot override it.
- Timed snoozes expire automatically, including an app-wide snooze until a chosen time. They do not require per-workspace resume. The main assistant's scoped snooze tool remains limited to one target; app-wide controls are separate.
- Individual snooze deadlines keep counting down during a global halt or timed app-wide snooze. Do not freeze or reset them. After the global restriction clears, a workspace with an unexpired snooze waits until its original deadline. Otherwise it can enter paced catch-up. A remaining indefinite halt always requires explicit resume.
- Direct user requests may run in a snoozed workspace without switching proactive mode back on. Agent-originated nudges, including those labelled urgent, wait for reactivation.
- Support explicit reminders and deadlines for work needing user attention. Initially keep them in Howcode and available on return. External delivery channels can be installed or created when requested.
- Do not prescribe a built-in to-do panel. The user can ask the assistant to create one or find an installable component.

## Why this direction

The product starts with an ongoing relationship, not a list of sessions. The main assistant coordinates across workspaces while local bots, where present, understand their own work. A workspace can remain manual without a resident. An idle workspace is not automatically neglected, and a busy one is not automatically progressing.

Igor's concrete example is a Board item untouched for a month. The main assistant raises it with the workspace resident, which understands blockers and repository conventions. If appropriate, the resident creates a worktree and delegates implementation. The main assistant does not need to learn the repository's operating details to make that useful intervention.

Folder roles express how the user's life is organised. `Work` might contain active projects, `Frameworks` reference repositories relevant only when updates matter, and `Documents` life admin. A main-job project may deserve caution rather than extra initiative. Recent agent output alongside an old user message can mean there is something for the user to review, not something for another worker to start.

## Current foundations and constraints

- Durable already owns persistent conversations, task execution and recovery. Explicit input submissions start turns. Passive context writes do not wake an idle assistant.
- Production backend and Harness startup are demand-driven today. A listening web server does not guarantee that scheduled work has resumed.
- Bots already provides installation-assistant identity and workspace bots. Fresh-install component defaults do not include Bots, Context, Agents or Pulses.
- Pulses provides scheduled workspace runs. Its current parent reporting is passive and its ownership is not automatically the main assistant.
- Pulses currently does not retain all missed schedule occurrences for catch-up. Snooze and controlled resume therefore need an explicit owning implementation, not just different prompt wording.
- Board currently binds a conversation to one family Board and accepts `board_id` for reads, not cross-board writes. Resident contributions to the main Board need a supported public capability without replacing their local membership. Howcode's resolved Agents package still bundles the older Board implementation, so dependency composition must be checked before changing this boundary.
- Existing Notes, Board and Agents should remain the foundations for continuity and delegation. Do not build a parallel runtime, memory store or scheduler.
- Installed services and shell tools are trusted host code. Working-directory instructions are not a filesystem sandbox.
- Full component activation waits for idle boundaries. An always-available assistant must still finish turns and rest.
- Context's existing rollover stays inside the native conversation. Preserve this and the workspace resident's family, rather than treating every context window as a new session requiring Board migration.

Source anchors: `desktop/durable-runtime/host.ts`, `desktop/conversation-runtime.ts`, `desktop/plugins/conversations.ts`, `components/packages/service/default-packages.generated.ts`, `../howcode-components/packages/bots/src/resident-service.ts`, `../howcode-components/packages/pulses/src/service.ts`, `../pi-durable-components/packages/pulses/README.md`, `../pi-durable-components/packages/board/src/membership.ts`, `../pi-durable-components/packages/board/src/contract.ts`.

## Proposed workboards

These are planning groups, not created boards or implementation assignments.

### 1. Reliable runtime and fresh-install foundation

Proposed threads:
- Eager backend and Harness startup, with recovery independent of the browser.
- Minimal installed capabilities, user-chosen assistant home and default identity.
- Setup wizard handing its selected preferences into the first conversation.
- Agent-led launch configuration, visible setup blockers and the canonical `Howcode setup` Board thread.
- Developer validation of fresh profiles, browser-independent operation, restart and preserved identity. No recurring app-test assignment for the assistant.

### 2. Resident families and Board coordination

Proposed threads:
- Explicit optional resident creation, classic resident-free workspaces and continuing family ownership.
- Local Board authority and workspace worker participation.
- Resident-authored overviews and threads on the main Board without sharing all local context.
- Passive Board updates versus explicit messages that wake a resident.
- Manual chats joining a resident's family when one exists, with Board-first documentation and optional Notes lookup.

### 3. Awareness and initiative

Proposed threads:
- User-described discovery roots, nested exclusions and proposed workspace enrolment.
- Workspace listing with activity signals, proactive policy and short resident comments.
- Main-assistant check-ins that consult residents rather than taking over their work.
- User review, blockers and deadlines as reasons for attention, without compulsory busywork.

### 4. Snooze and controlled scheduling

Proposed threads:
- Shared subscription and delivery contracts for concrete event sources, with scheduled work as one source rather than the owner of every wake-up.
- Adaptive initiative, user-editable timing levels and prompt-activity patterns, with an internal timer-adjustment tool.
- Per-scope proactive activity accounting so scheduled Pulses and event-triggered work suppress redundant generic check-ins.
- Scoped snooze tool and card, backed by persistent target state.
- Shared snooze participation for Pulses and other proactive trigger components.
- Repeated-job deduplication and paced release of distinct due work.
- Missed-period context injected into each coalesced run, with a configurable catch-up concurrency limit and provider backoff.
- Indefinite global halt with per-workspace resume, distinct from automatically expiring timed snoozes. Original workspace snooze deadlines keep counting down under either.
- Reminder delivery in Howcode, with optional external integrations.

### 5. Assistant-shaped environment

Proposed threads:
- Feature-owned package operations and explicit capability selection, shared by agent and user interfaces.
- Yielding for component activation, then continuing through the shared subscription and delivery contract.
- Generated views and workspace layout tools.
- Persistent component views, including user-requested task panels and notification channels.

Start with board 1. The later order and the exact capability subset needed for agent-led setup remain open. Essential first-run presentation belongs in board 1, not behind a later UI redesign. Reuse existing machinery and keep feature ownership in the appropriate Howcode or portable component.

## Important tradeoffs

- Fresh-install support makes the first slice larger than an eager-start fix. It needs a deliberate component composition and an honest unconfigured state.
- Agent-led service setup avoids a maintained matrix of OS-specific installers. It still needs a usable foreground bootstrap, correct executable and profile information, and evidence that the resulting setup works. Privilege or credential requirements cannot be wished away.
- Process uptime and assistant initiative are independent. An always-running server need not initiate work, and a periodic policy cannot run while a manually launched server is stopped.
- Boot startup, login startup and operation after logout are different capabilities. The assistant must verify the chosen one in the actual environment. Relevant references: [systemd user lingering](https://www.freedesktop.org/software/systemd/man/252/loginctl.html), [Apple launchd agents and daemons](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html), [Windows logon tasks](https://learn.microsoft.com/en-us/windows/win32/taskschd/starting-an-executable-when-a-user-logs-on).
- Delegation preserves workspace knowledge and ownership, but requires meaningful reporting and a way to reach the right bot.
- Activity signals can guide attention, but must not become a rule that generates busywork or nags the user.
- Git authorship is not reliable human-versus-agent attribution. Preserve the underlying signals rather than presenting inferred user activity as fact.
- Folder policies initially guide agents through instructions and tool output. They are not guaranteed filesystem access restrictions or a new admission-permissions system.
- Standing instructions preserve autonomy. They do not create technical isolation between workspaces.
- Workspace Board membership must remain local even when residents publish to the main Board. This needs an explicit capability, not attaching every resident to one family or mirroring all conversations.
- Snooze is operational state, unlike the instruction-led folder preferences. Scheduled components must actually honour it. Arbitrary OS jobs that bypass Howcode cannot be assumed to participate.
- Catch-up trades timeliness against provider pressure and obsolete work. Preserve due work without blindly replaying every missed interval or uncertain external side effect.
- Exposed behaviour attracts dependencies, including from agents. Small semantic gateways let feature internals change. This is not a reason to hide diagnostics or to create a universal RPC interface. Shared primitives must earn their place through concrete consumers.
- Frequent generic check-ins can be costly even when nothing happens. Adaptive timing should back off, respect configured minimum gaps and reuse scheduled work as a check-in opportunity. Learned habits are estimates, not proof that the user is absent.

## Open questions

None outstanding from the planning rounds. Implementation thread boundaries and dependency details remain to be worked out without reopening the agreed product behaviour.

## Proposed next steps

1. Bound board 1 into implementation-ready threads. Keep startup and recovery reliable without turning the assistant into an app tester. Use the setup Board thread rather than a new configuration-record feature.
2. Trace cross-board participation, feature gateways and shared subscription/admission boundaries through their owning public APIs before estimating those boards. Do not create parallel stores or silently change portable package contracts.
3. Refine the dependency order while preserving optional workspace residents and the main-assistant versus workspace-resident split.
4. Begin implementation only after explicit approval.
