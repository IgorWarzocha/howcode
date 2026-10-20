# Assistant-first Howcode

Planning paused at Igor's request. Product direction and the decisions below are agreed. Workboard boundaries and unresolved behaviour are proposals, not implementation approval.

## Goal

Howcode starts with you and your main assistant. It remains available without an open browser, notices where attention might help and shapes its working environment with you. Manual sessions remain available, but do not organise the product.

## Agreed decisions

### First delivery and setup

- Deliver reliable runtime behaviour first. Proactive discovery and autonomous task completion are later milestones.
- The first delivery must cover fresh installations, not just Igor's configured development profile.
- The user chooses the main assistant's backing folder. Do not silently assign its home to the app directory or a hidden profile folder.
- After model setup, go straight into conversation with a default identity and prepared capabilities. Do not require naming or detailed instruction setup before meeting the assistant.
- Include setup for both manual launch and unattended operation, including automatic restart and boot startup where selected.
- Let the main assistant configure the user's actual OS and environment through available tools. Do not build a platform-specific service-management framework merely to cover every environment.
- The wizard collects model access, home folder, launch preference and initiative frequency. The assistant then implements and verifies that configuration in conversation.
- If the chosen unattended setup cannot be established, setup remains incomplete. Surface the blocker and required user action rather than silently substituting a weaker launch mode.
- Process uptime and initiative are separate choices. Support conversational sidequests and daily, hourly or user-chosen proactive intervals, independently of manual launch or boot startup.
- Conversational sidequests are not tied to browser presence. The assistant may follow related work after the user leaves and judges when to wind down.
- Proactive work follows the user's standing instructions. Do not introduce a separate blanket approval policy for unsolicited work.

### Residents, context and Boards

- The main assistant works within its own workspace. For work elsewhere, it talks to workspace bots or starts threads rather than carrying out those tasks itself.
- Workspace bots own local judgement: existing changes, competing work, worktree conventions, blockers and whether anything needs doing at all.
- Each workspace resident anchors one continuing conversation family. Its workers and Board remain with that family. Context rollover must not manufacture a new resident family or Board.
- The main assistant has its own context and top-level Board. Workspace residents retain local context and share it with their workers. Do not collapse all residents into the main assistant's family to obtain shared Board access.
- Workers can create and contribute to local Board threads. The workspace resident can create, close and reopen its local threads.
- Workspace residents can create top-level threads and publish high-level overviews to the main assistant's Board. Link the underlying local work rather than copying all of its context into the main assistant.
- The main assistant can create a top-level thread for a workspace resident. A Board notification does not wake an idle resident. Urgent work requires an explicit message. Otherwise the resident picks up relevant updates on its next wake.
- Context sharing, Board participation and turn-start are separate contracts. Preserve that distinction in tools and presentation.

### Workspace awareness and folder intent

- The main assistant needs a cross-workspace progress surface when deciding what to do. Older untouched work gets attention first, subject to context. It should adapt to the user, not apply a rigid inactivity rule.
- Track last user message separately from last Howcode activity. Show Git progress separately too. Fresh bot activity must not conceal a long absence of user attention or work waiting for review.
- Discover projects within user-chosen parent folders and propose new workspaces for enrolment. Do not automatically enrol every discovered folder.
- Roots carry user-described roles and priorities, not just filesystem paths. Examples include active coding work, low-priority reference repositories, life-admin documents and a main-job folder requiring extra care.
- Users can mark nested folders off limits or observation-only for the main assistant. Observation-only workspaces can provide current information, but the main assistant must not suggest or initiate extra work there. The user may still initiate work directly in those workspaces.
- Start with standing instructions and informative tool output for those policies, not a new permission or isolation framework. Workspace listings must show the policy and short, agent-maintainable comments that remind the main assistant of the workspace's basics.
- Doing nothing can be the right decision. A stale thread is a reason to ask the resident about blockers, not an automatic order to start a worker.

### Snooze, pause and reminders

- When asked to leave work alone temporarily, finish already accepted work and its reporting, but do not initiate unrelated work. Explicit task cancellation remains separate.
- Give the main assistant a tool that presents a scoped snooze card. Choices include tomorrow morning, evening, a number of hours or a number of days.
- Snooze targets one workspace or the main assistant's own scope, never the entire app through that scoped tool. It suspends proactive admission from Pulses and comparable scheduled components for that target.
- On reactivation, deduplicate repeated due pulses and queue distinct remaining jobs. Release work gradually rather than starting everything at once and hitting provider limits. The exact catch-up and rate-limit policy remains open.
- Provide a separate app-wide pause button. Resuming afterwards is per workspace, not a single global resume operation. The interaction with existing snooze deadlines still needs definition.
- Support explicit reminders and deadlines for work needing user attention. Initially keep them in Howcode and available on return. External delivery channels can be installed or created when requested.
- Do not prescribe a built-in to-do panel. The user can ask the assistant to create one or find an installable component.

## Why this direction

The product starts with an ongoing relationship, not a list of sessions. The main assistant coordinates across workspaces while local bots understand their own work. An idle workspace is not automatically neglected, and a busy one is not automatically progressing.

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
- Agent-led launch configuration, verification and visible setup blockers.
- Practical acceptance: fresh profile, closed browser, restart and preserved assistant identity.

### 2. Resident families and Board coordination

Proposed threads:
- Workspace resident creation and continuing family ownership.
- Local Board authority and workspace worker participation.
- Resident-authored overviews and threads on the main Board without sharing all local context.
- Passive Board updates versus explicit messages that wake a resident.
- Manual workspace chats and their relationship to the resident, once decided.

### 3. Awareness and initiative

Proposed threads:
- User-described discovery roots, nested exclusions and proposed workspace enrolment.
- Workspace listing with activity signals, proactive policy and short resident comments.
- Main-assistant check-ins that consult residents rather than taking over their work.
- User review, blockers and deadlines as reasons for attention, without compulsory busywork.

### 4. Snooze and controlled scheduling

Proposed threads:
- Scoped snooze tool and card, backed by persistent target state.
- Shared snooze participation for Pulses and other proactive trigger components.
- Repeated-job deduplication and paced release of distinct due work.
- App-wide pause with explicit per-workspace reactivation.
- Reminder delivery in Howcode, with optional external integrations.

### 5. Assistant-shaped environment

Proposed threads:
- Supported package installation and explicit capability selection.
- Yielding for component activation, then continuing the setup task.
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

## Open questions

- How should agent-created launch and scheduling configuration be inspected, changed or removed later?
- Does adding a workspace establish its resident automatically, and what happens to existing workspaces?
- How should a manually opened workspace chat participate in the resident's family and Board? This was not settled by the clarification of main-assistant versus workspace context.
- What form should the cross-workspace progress surface take for the assistant and the user?
- What are the default morning and evening times, and which timezone governs snooze and reminders?
- Does resume coalesce missed occurrences into one run per pulse? How are time-sensitive or no-longer-relevant jobs handled?
- How should app-wide pause interact with timed snoozes, new workspaces and reactivating the main assistant's own scope?
- Can a direct user request or urgent message override snooze, or must the target be explicitly reactivated first?
- Which provider and concurrency limits should paced resume respect, and what happens when those limits are unknown?
- What are the acceptance criteria and boundaries of the first implementation slice?

## Proposed next steps

1. Resume with the manual-session and snooze questions above. Do not reopen the settled product model.
2. Bound board 1 into implementation-ready threads with observable acceptance criteria, including the minimum capability needed for agent-led setup.
3. Trace cross-board participation and snooze through their owning public APIs before estimating those boards. Do not create parallel stores or silently change portable package contracts.
4. Refine the dependency order while preserving the main-assistant versus workspace-resident split.
5. Begin implementation only after explicit approval.
