# Implementing assistant-first Howcode

This is the implementation companion to [Assistant-first Howcode](assistant-first.md). That document owns the agreed product behaviour. This one maps the changes, their owners and the order in which they can land. It is a proposal, not permission to begin implementation.

The investigation covered seven areas across Howcode, Howcode Components and Pi Durable Components on 20 October 2026. Howcode's starting revision was `4519f1f5`. Current behaviour below is source-backed. Proposed contracts are not APIs that already exist.

## What the investigation changes

Most of the pieces exist. The missing work is in how they start, connect and retain ownership.

- A listening server does not mean the backend or Durable Harness has started. Backend recovery also waits for another request today.
- Fresh installations lack several components that the configured development profile uses. The current installation assistant also lives in the default workspace, not a chosen home workspace.
- Durable task ownership is not a general conversation-family API. Board must own family membership, while Bots keeps the resident's stable anchor and current conversation.
- Howcode still resolves Agents 0.5 with Board bundled inside it. Current portable Agents 0.6 and standalone Board cannot be substituted independently without migrating saved extension selections.
- Pulses runs child conversations and reports passively. It does not currently wake the main resident, retain all missed occurrences or provide the agreed snooze controls.
- Native `user` messages can come from agents and schedulers. Trusted input provenance is needed both for snooze exemptions and for honest user-activity signals.
- Component installation and generated views exist. Waiting for an exact component generation to activate, then reliably continuing setup, does not.

The first code change can be small: make startup and backend recovery eager. The first complete assistant-first experience is larger. It needs working setup, a real home workspace, the selected capabilities and an operational initiative policy. Saving a frequency preference is not the same as configuring it.

## Ownership

Keep the feature state with the feature. Core should provide the small host contracts that components cannot implement themselves.

| Area | Owning implementation | Host responsibility |
| --- | --- | --- |
| Process startup and recovery | Howcode server and existing `DesktopServiceClient` lifecycle | Open the same profile, bind services, resume Harness, report failure |
| Assistant setup, identity and home | Howcode Components, Bots | Provider/model access, workspace creation, conversation creation and shell entry |
| Local family membership and cross-Board participation | Pi Durable Components, Board | Compose its public capabilities into Bots and Agents |
| Context and Notes | Existing Context components | Keep native conversation identity stable and resolve explicit lookup targets |
| Scheduling, proactive admission and catch-up | Pi Durable Components, Pulses | Supply trusted input provenance, resident targets and lifecycle binding |
| Snooze cards and app-wide controls | Howcode Components, Pulses | Expose the component's controls without duplicating its policy |
| Folder intent and workspace awareness | A Howcode awareness component | Existing workspace identity, activity projection and explicit enrolment |
| Package installation and activation | Existing Howcode package service | Narrow agent operations through the existing app-control dispatcher |
| Generated and persistent views | Existing UI and artefact components | Existing presentation slots and explicit host grants |

No new runtime, memory store, Board mirror or scheduler is proposed. A component-owned folder-policy record is configuration, not agent memory. The canonical setup narrative remains a Board thread.

## 1. Make the runtime available without a browser

### Current boundary

The production server constructs a lazy service client. RPC or terminal activity starts the backend. The backend sends its ready message after service composition, without opening Durable. Harness acquisition is another lazy step. If the backend exits, it restarts on the next request.

Durable 1.3 already restores persisted live tasks and dispatches them after `resume`. We need to reach that path reliably, not replace its recovery mechanism.

Source anchors:

- `src/server/runtime.ts:39`, `src/server/index.ts:16`
- `src/desktop-host/desktop-service-client.ts:37`
- `src/desktop-host/desktop-service/lifecycle-startup.ts:34`
- `desktop/service-host-runtime.ts:223` and `:426`
- `desktop/durable-runtime/host.ts:67`, `:104` and `:123`

### Proposed thread: runtime startup and supervision

Extend the existing client lifecycle with an explicit, awaited start. The server invokes it before announcing readiness. The backend's ready handshake comes after Harness acquisition, migration, component binding and resume.

Use this order:

1. Launch the backend for the selected profile.
2. Seed or reconcile package inventory and construct service contributions.
3. Open the existing Durable database and run required migrations.
4. Bind package and component services.
5. Resume Durable tasks.
6. Report backend readiness and complete server startup.

The same lifecycle owner should recover unexpected backend exits without waiting for a browser request. Use bounded, backed-off recovery and existing process-generation handling. Do not add a second supervisor inside the server.

Keep process readiness separate from model and assistant configuration. A fresh profile without credentials can have a healthy Harness and an unconfigured assistant. Storage or component-binding failure is a runtime failure, not an unconfigured state.

Pre-listen failures must reach the start caller and server stderr. Later headless failures need stderr reporting too, not only an event for connected browsers. A new health-endpoint framework is unnecessary for this first change.

Preserve migration-before-resume, one Harness per profile, idle-boundary package replacement and shutdown ordering. Stop new admission, drain or close the Harness, then unbind and dispose components. Failed cleanup must not be presented as a clean generation ready for replacement.

**Completion evidence:** a headless start resumes existing work, a backend crash recovers without a client, and an unconfigured profile remains usable for setup. Bind or storage failure never produces a false ready signal. Recovery does not resubmit accepted turns as new requests.

## 2. Establish one family without changing native task ownership

### Current boundary

Bots persists workspace identities and the installation resident separately. The installation resident records current and historical conversation IDs, but no home workspace. Its chats are created in `DEFAULT_WORKSPACE_ID`.

Ordinary Howcode chats are native ownerless conversations. Agents workers are task-owned children. Board derives default membership from that owner tree, with explicit bindings taking precedence. Fork ancestry, workspace association and task ownership are different things.

Context already rolls over inside the same native conversation. Its Howcode adapter disables automatic idle rollover. Neither behaviour calls for a new family or Board.

Source anchors:

- `../howcode-components/packages/bots/src/storage.ts:6` and `:46`
- `../howcode-components/packages/bots/src/resident-service.ts:75` and `:198`
- `../howcode-components/packages/sdk/src/plugins.ts:139`
- `desktop/plugins/conversations.ts:125`, `desktop/durable-runtime/host.ts:175`
- `../pi-durable-components/packages/board/src/membership.ts:58`
- `../howcode-components/packages/context/src/service.ts:8`

### Proposed thread: separate Agents and Board safely

Upgrade the Howcode Agents adapter from resolved portable Agents 0.5 to the standalone-Board composition. Install and select Board with Agents where the old bundled Board was available. Migrate affected saved conversation and worker extension selections before those tasks resume.

Do not select standalone Board beside Agents 0.5. That registers two implementations of the same tool. Do not upgrade Agents alone and remove Board from existing conversations by accident.

The existing extraction preserves Board document kinds and storage keys. Dependency and selection migration should not become a Board-data conversion. Follow the owning Board migration guidance and inspect actual stored selections, including workers, rather than changing only future defaults.

Source anchors: `../howcode-components/packages/agents/package.json`, `../howcode-components/packages/board/AGENTS.md`, `../pi-durable-components/packages/board/README.md`.

### Proposed thread: stable anchors and host enrolment

Bots should retain a stable family anchor independently of the current chat. Board should expose a narrow host-callable operation to enrol a newly created, idle conversation under that anchor. It can reuse its existing validated membership logic, but today `attach` is a tool action, not a public host method.

Membership alone is insufficient. Board currently allows only the original root conversation to close or reopen threads (`../pi-durable-components/packages/board/src/store.ts:183`). The public contract also needs a host-controlled resident-authority binding that follows the designated continuing resident when its current conversation changes. Keep the Board anchor stable and distinguish resident authority from ordinary membership. Manual chats and workers must not gain lifecycle authority merely by joining the family.

Enrol before first input or presenting the new chat as ready. Make the operation retryable against the same conversation and anchor. If it fails, preserve the transcript and report incomplete creation rather than quietly opening the wrong family.

- New manual chats in a resident workspace join its local Board family automatically. There is no extra join prompt.
- They keep independent native conversation context.
- New installation-resident chats keep the same family even when the current chat changes.
- Workers retain native task ownership and inherit their parent's local membership.
- Resident-free workspaces keep ordinary chats. Discovery, workspace creation and upgrades never create a resident automatically.

Bots must not keep a second membership map. It supplies the stable anchor. Board owns membership. Do not reparent native conversations to imitate family membership, because native ownership also controls execution and cancellation.

Keep historical chats and Boards readable. Do not sweep all pre-existing workspace chats into a new family. When an old resident has several historical roots, identify and preserve the actual continuing Board rather than blindly treating history order as authority or merging Boards. Missing roots should be visible recovery problems, not reasons to manufacture replacements.

Explicit cross-agent Notes reads already exist. Resolve the intended conversation and use that capability deliberately. Do not add default Notes fan-out or shared context injection.

**Completion evidence:** new resident threads share one local Board while retaining separate transcripts. After a current-conversation change, the designated resident can still close and reopen its local threads, while manual chats and workers cannot. Workers retain their lifecycle. Context rollover and restart retain the same native IDs. A workspace without a bot still has normal chats. Existing identities, transcripts and historical Boards remain accessible.

## 3. Make first-run setup a conversation with a prepared assistant

### Current boundary

The shell starts on a landing view. There is no complete first-run wizard in that route. Provider login APIs already exist. The Pi resource directory is not the assistant's working folder and must not be repurposed as one.

Fresh package defaults omit Bots, Context, Agents and Pulses. The installation resident's exact extension selection also omits `coding-tools`, so its present defaults cannot carry out OS launch configuration.

Source anchors:

- `src/app/state/workspace.ts:15`, `src/app/app-shell/app-routes.ts:76`
- `desktop/settings/provider-auth.ts:16`, `desktop/settings/paths.ts:5`
- `components/packages/service/default-packages.generated.ts:2`
- `../howcode-components/packages/bots/src/resident-contracts.ts:23`
- `desktop/durable-runtime/extension-composition.ts:17`

### Proposed thread: Bots-owned setup and home workspace

Bots should own the setup workflow and resident state. The shell supplies the first-run entry and opens the resulting ordinary conversation. Reuse host-owned model and authentication APIs. Do not create another setup identity in the shell or revive the previously rejected full-page assistant management screen.

Collect the agreed choices: model access, assistant home folder, launch preference and initiative frequency. Create or select the corresponding directory-backed workspace and persist its ID on the installation resident. Use a default identity and enter conversation without a naming or instruction-writing gate.

Keep the installation role distinct from optional workspace bots. Expose it through a narrow resident resolver so app-control and Pulses can locate it without title matching. Its home is an ordinary workspace target, not a second scheduler scope type. Ensure that the home has one resolved resident owner. If an existing local bot conflicts, surface that before setup rather than silently replacing an identity or choosing precedence.

For existing profiles, retain identity, current and history IDs, models, selections and transcripts. Collect the missing home choice explicitly. Do not silently move old default-workspace conversations into the chosen folder or change the Pi credentials directory.

### Prepared capabilities

The proposed first-delivery composition is:

| Capability | Selection or package |
| --- | --- |
| Installation identity | Bots, `installation-resident-identity` |
| Context, Notes and history | Context, `howaboua.context` |
| Delegation | Agents, `howaboua.agents` |
| Board | Standalone Board, `howaboua.board`, after the coordinated upgrade |
| App and conversation control | Existing `howcode.app-control` |
| Filesystem and command execution for setup | Existing `coding-tools`, providing `read`, `write`, `edit` and `bash` |
| Chosen initiative schedule and controls | Pulses and its Howcode adapter |

This is a configurable resident selection, not a fixed core chat or coding bundle. `coding-tools` is already registered by the host, not a missing profile package. UI visibility remains independent of selected agent capabilities. Visualise, bespoke panels and general package administration are not prerequisites for the first setup conversation.

Change generated default registrations through their owning generator, not by editing generated files. Seed fresh installations without resetting returning users' explicit choices.

### Proposed thread: actual launch configuration and setup record

Use one canonical `Howcode setup` thread on the main Board. Keep a stable reference to it and reuse it on retries. Record selected choices, actual paths and operating conditions, verified configuration, blockers and installed or generated views there. Operational settings stay with their owning features. Do not build a parallel setup journal or memory system.

Give the assistant the existing host diagnostics and any missing concrete launch facts: executable, arguments, profile paths and relevant effective environment. Never include secret values. Existing diagnostics already expose Node executable, version, working directory and profile/resource paths.

The assistant uses its tools to configure the actual OS. Distinguish manual launch, restart after failure, login startup, boot startup and survival after logout. Privilege requirements and failed setup stay visible. A selected unattended mode that has not been established leaves setup incomplete.

A successful launch configuration does not prove that the selected initiative schedule works. Record and verify those separately. This is setup work, not a recurring synthetic app test assigned to the assistant.

Source anchors: `desktop/service-host-runtime.ts:297`, `desktop/package-cli.ts:37`.

**Completion evidence:** a fresh profile signs in, selects a home and enters the prepared conversation. A returning profile retains its data. The setup thread is reused across retries. The chosen launch and initiative modes are either operational or explicitly incomplete, never silently downgraded.

## 4. Give proactive work a real admission and recovery contract

### Current boundary

Pulses already owns definitions, scheduling and durable execution. Its checkpoints contain schedule keys and task references, not the agreed missed-period queue. Its five-minute scan finds current due work and seeds the current slot when schedules are added or changed. Serialising scans does not limit concurrent running jobs.

A normal Pulse runs in a child conversation, waits for the native input receipt, then waits for a passive parent-write receipt. Preserve that accepted-work and reporting boundary.

Source anchors:

- `../pi-durable-components/packages/pulses/src/state.ts:9`
- `../pi-durable-components/packages/pulses/src/index.ts:103`, `:333` and `:372`
- `../pi-durable-components/packages/pulses/src/schedule.ts:144`
- `../pi-durable-components/packages/pulses/src/tasks.ts:53`
- `../howcode-components/packages/pulses/src/service.ts:104` and `:275`

### Proposed thread: trusted input origin and accepted work

Add a closed, host-derived input-origin contract at real ingress boundaries. Carry it through durable submission metadata and expose the necessary part to components.

Direct composer input is human-origin. Agent tools, scheduled work and ordinary MCP calls are not human-origin merely because they submit a user-role message. A bearer token authenticates a client, not a human decision. Message text, an `urgent` argument and a caller-supplied source flag cannot grant a snooze exemption.

Also retain accepted-work lineage. Source alone cannot distinguish an unrelated new nudge from a worker completing an already accepted task. Host/native-validated task or receipt linkage should allow accepted work and its settlement to finish. Do not use an agent-controlled `continuation: true` escape hatch. Do not count those continuations as new human activity.

This is admission accounting, not a new intent classifier or permissions framework. Standing instructions still govern whether an agent is proposing unrelated work. The mechanical boundary must prevent paused producers from submitting new proactive work and preserve already accepted work.

The same provenance feeds the workspace last-human-message projection. Today's `RuntimeOriginDoc` records workspace association, not input origin.

Source anchors: `desktop/durable-runtime/conversation-origin.ts:4`, `desktop/app-service/composer-actions.ts:53`, `desktop/durable-runtime/app-control/chat-actions.ts:46`, `../howcode-components/packages/sdk/src/plugins.ts`.

### Proposed thread: one shared admission owner

Keep persisted proactive admission policy with portable Pulses and expose a narrow public gate. The Howcode adapter owns the scoped card and separate app-wide controls. Participating scheduled components and agent-originated proactive dispatch must consult that same owner. Core supplies provenance and routes requests, not snooze policy.

Define the public contract before changing producers: scope identity, current restrictions, admission result, accepted-work linkage and reactivation. Unsupported producers must not claim to honour snooze. Trusted host code and arbitrary OS jobs can bypass Howcode, so this is not an isolation guarantee.

The persisted state must distinguish these cases:

| State | Reactivation |
| --- | --- |
| Workspace or main-scope timed snooze | Automatically at its original deadline, unless another restriction remains |
| Timed app-wide snooze | Automatically at its deadline, retaining unexpired local snoozes |
| Indefinite global halt | Each workspace, including the main scope, requires individual resume |
| Workspace created under that halt | Starts paused and requires its own resume |

Timers never clear an indefinite halt. Local deadlines continue ageing beneath both kinds of global restriction. A direct user request can run without resuming proactive mode. New agent nudges wait even when labelled urgent. Accepted work and reporting drain normally. Cancellation remains a different operation.

The scoped tool targets one workspace or the main scope. Its card resolves morning to 09:00 and evening to 18:00 in server-local time, and shows the actual date, time and timezone. App-wide controls remain separate.

### Proposed thread: missed work and paced catch-up

Extend the existing Pulses checkpoints and task admission, rather than placing a second queue beside Durable.

- Retain a durable due cursor and enough information to account for missed occurrences across snooze and process downtime.
- On reactivation, coalesce into one fresh run per distinct job. Inject the missed count and period start/end programmatically.
- Queue different jobs and apply the configurable catch-up execution limit. An admission mutex is not that limit.
- Honour identifiable provider backoff. Do not reinterpret every error as rate limiting or retry uncertain external side effects blindly.
- Report deleted, disabled, expired or superseded work rather than silently replaying an obsolete definition.
- Preserve native task IDs and receipt-based idempotency through crashes. Keep already accepted jobs separate from not-yet-admitted catch-up.

Retain user-owned Pulse definitions, instructions, artefacts and existing schedule-change seeding behaviour. Derive new missed-period state from the point where tracking becomes reliable. Do not fabricate exact historical counts that old checkpoints never recorded.

### Proposed thread: the main assistant's cadence

Use the chosen home workspace and an explicit setup-created `pulses/<id>/PULSE.md` for the selected frequency. The assistant authors and records this configuration as part of setup. The adapter should not silently create user Pulse files, and no synthetic parallel schedule store is needed.

Add a supported run target that submits to the continuing main resident. A passive report from a normal child Pulse does not wake that resident and is insufficient on its own. Keep child execution as the existing default for ordinary Pulse jobs. Both targets use the same scheduling, admission and native receipt machinery.

Conversational sidequests remain ordinary continuing agent work. They do not need another periodic job or an open browser. Their wind-down and unrelated-work choices follow standing instructions, with the same accepted-work boundary when snooze begins.

**Completion evidence:** browser-independent cadence, restart-safe due work, correct local and global restriction precedence, one coalesced run per job with correct metadata, bounded concurrent catch-up, visible obsolete jobs and accepted work finishing without waking idle parents merely to report.

## 5. Connect residents without merging their context

### Current boundary

Board has one effective local membership per conversation. `attach` moves a leaf between Boards. `board_id` is for reads, not cross-Board writes. Neither is the required participation mechanism.

Board notices are passive. The existing `chats.send` app-control operation submits native input and returns a receipt. Workspace-bot mains are listed, but the installation resident lacks an explicit app-control resolver.

Source anchors: `../pi-durable-components/packages/board/src/membership.ts:13` and `:118`, `../pi-durable-components/packages/board/src/contract.ts:73`, `../pi-durable-components/packages/board/src/notices.ts:40`, `desktop/durable-runtime/app-control/index.ts:31`, `desktop/durable-runtime/app-control/chat-actions.ts:46`.

### Proposed thread: additional Board participation and resident routing

Extend portable Board with explicit participation in a second write target. Keep the resident's local Board as its default and keep its workers there. The grant should permit the agreed top-level thread creation and contributions without silently granting every worker remote participation or local-root authority on the main Board.

The local resident retains local thread lifecycle authority. Workers can contribute locally. The main assistant can create a top-level thread addressed to a resident without making that resident a member of the main assistant's context family.

Expose stable resident addressing from Bots. Reuse `chats.send` for explicit work requests, subject to the admission contract. Do not identify the installation assistant by its chat title or use a Board notice as a disguised wake-up.

Agents 0.6 accepts an optional Board `threadReference` capability, but the current Howcode Agents adapter does not receive it. Provide a concrete composition port for that handoff. Do not add a peer-service locator or make Board depend on Agents. Removing Board must leave ordinary delegation usable, with Board handoff unavailable rather than broken.

Residents publish short overviews with links to local work. Instructions should encourage useful Board documentation and deliberate Notes lookup, not copy every local transcript into the main assistant. In resident-free workspaces, a user-requested task creates a normal chat. A listing or check-in never creates a permanent bot as a side effect.

**Completion evidence:** a resident posts to the main Board while its local Board and workers remain intact. Passive notices do not start turns. Explicit messages reach the right resident, and snoozed agent nudges wait. Local thread handoff still works after the Agents/Board split.

## 6. Add workspace awareness without turning it into an access-control system

### Current boundary

Existing directory scans refresh known directories and Git worktrees. They are not discovery beneath user-chosen roots. App-control's workspace list returns identity, path and workspace-agent information, not the agreed overview.

The conversation projection records modification and assistant timestamps, not last human input. Git status exists in navigation, but its current host/renderer contract is not a public service for an awareness component.

Source anchors:

- `components/working-directories/service/directory-import.ts:3`
- `../howcode-components/packages/classic-navigation/src/service/directory-import.ts:38`
- `desktop/durable-runtime/app-control/index.ts:42`
- `desktop/chat-repository/schema-sql.ts:28`, `desktop/chat-repository/conversation-projection.ts:49`
- `../howcode-components/packages/classic-navigation/src/host-contribution.ts:22`

### Proposed threads: folder intent, discovery and on-demand overview

A Howcode awareness component should own selected roots, roles, priorities, nested policies, short workspace comments, discovery and enrolment proposals. Use a narrowly scoped component data-location grant if needed. Do not make its persistence depend on the optional Bots service or put proactive folder policy into core workspace tables.

Core continues to own directory/workspace identity and existing membership. Expose the small listing and explicit-enrolment operations the component needs. Scanning produces candidates, not workspaces. Removing a discovery root never removes a workspace, transcript or folder.

The component's on-demand overview should reuse those identities and report:

- Workspace and resident identity, or explicitly no resident.
- Role, priority, observation-only or off-limits policy, and the short comment.
- Last human message and last Howcode activity as separate signals.
- Available Git progress separately, without inferring human authorship.
- Relevant work waiting for review or blocked, using Board references rather than mirrored Board state.

Add the human timestamp only after trusted ingress provenance exists. Old records without reliable attribution should show unknown, not a guessed value. Optional Git failure should show unavailable, not clean. The overview must still work without navigation or Git capabilities installed.

Policy is informative output and standing instructions. Observation-only may inform the assistant, but must not invite suggested or initiated work. Direct user work remains available. Off-limits paths should be excluded from this feature's discovery and attention. These policies do not claim to sandbox trusted tools.

Use the overview when needed. Do not inject it into every turn or implement an inactivity rule that manufactures work. Older untouched items are reasons to consult the resident and understand blockers.

**Completion evidence:** scanning shows candidates without enrolling them, explicit enrolment survives restart, policy is visible, bot activity does not refresh the human timestamp, and unavailable Git data does not prevent a useful listing.

## 7. Let the assistant change its environment through supported operations

### Current boundary

The package service already supports inventory, install, update, remove and activation status. The CLI can report an installation as pending. The compact `howcode` tool and MCP share one dispatcher, but currently expose conversation/workspace operations, not package administration or extension selection.

Full component activation can wait for active work and request leases to drain. There is no supported durable operation meaning "continue this setup after this exact component generation activates". A chat submission receipt does not supply that contract.

Visualise creates turn-bound views that freeze when the turn ends. It is not a persistent installed component. Existing artefact and component packages provide the durable presentation mechanisms.

Source anchors: `components/packages/service/ui.ts:256`, `desktop/package-cli.ts:72`, `components/packages/service/installed-components.ts:210`, `shared/app-control.ts:17`, `desktop/durable-runtime/extension-composition.ts:44`, `../howcode-components/packages/intelligent-ui/src/service.ts:103`.

### Proposed threads: narrow administration and activation continuation

Add typed inventory, installation and exact activation-status operations to the existing app-control catalogue and dispatcher. Reuse the package service. Expose per-conversation extension selection through the existing Durable selection path. Do not add generic service RPC, another installer or a second MCP implementation.

Installation receipts must distinguish installed inventory from an active generation. Add a small persisted continuation tied to the intended generation and originating conversation. The agent yields, the package owner reaches its idle activation boundary, and the continuation resumes once after activation or reports its failure. Do not wait for idle while holding the very turn or request lease that prevents it.

Capability removal or failed activation needs an explicit result. Retrying setup must inspect the original install receipt rather than reinstalling or repeating external setup side effects. This continuation also needs the accepted-work classification from the admission work.

Keep generated views and installable components distinct in instructions. A requested temporary panel can use Visualise. A persistent page or new host capability belongs in an installed component using existing SDK grants. Preserve producer-owned artefacts and version history. Do not add a mandatory to-do panel.

Audit `WorkspaceLayoutTools` during this ownership work: it is currently registered unconditionally in core. Its presentation policy should move behind the owning layout capability rather than being copied into a new assistant-control layer. Existing per-chat layout records and workspace defaults must survive that move.

**Completion evidence:** installation during a turn reports pending, yields, and continues on the exact active revision without repeating installation. Changing tool selection does not change renderer visibility. A generated view is not misreported as a package install.

## 8. Add reminders as reminders

There is no general reminder/deadline record today. The conversation inbox tracks unread assistant notifications, not due work. It cannot be relabelled to satisfy the requirement.

Add persistent one-shot due records referencing the relevant chat or Board thread, with a Howcode-owned on-return presentation. Reuse the scheduling and admission machinery where appropriate, but keep reminder delivery distinct from starting a Pulse work conversation. A due notification should not silently become an instruction to perform the underlying task.

Specify restart-safe delivery and acknowledgement, and preserve the reminder while the user is away. Use the existing inbox as a delivery surface if it fits, not as a substitute for the due record. External channels remain installable capabilities requested separately.

This is a small work item under scheduling, not a new task-management product or a second scheduler.

Source anchor: `desktop/chat-repository/schema-sql.ts:43`.

## Delivery order

The five proposed workboards in the product plan still fit, but they are not independent implementation batches.

| Order | Threads | Dependency and stopping point |
| --- | --- | --- |
| 1 | Eager startup and backend recovery | Can land with current component versions. Proves reliable runtime, not complete assistant setup |
| 2 | Agents/Board dependency alignment, public local enrolment and stable resident anchors | Must precede relying on standalone Board and new continuing-family behaviour |
| 3 | Fresh defaults, Bots setup, chosen home, direct conversation and setup Board thread | Needs the Board foundation and existing model/workspace host ports |
| 4 | Trusted origin and accepted-work linkage, shared admission, snooze and catch-up | Can be developed alongside setup after scope and target contracts are fixed |
| 5 | Main-resident Pulse target, selected cadence and actual launch setup | Joins runtime, setup and controlled scheduling into the first complete assistant-first experience |
| 6 | Optional workspace resident enrolment and cross-Board coordination | Uses the same family foundation and admission boundary |
| 7 | Discovery, policies, activity overview and reminders | Awareness needs provenance and resident routing. Reminder delivery needs the due path |
| 8 | General package control, activation continuation and persistent custom surfaces | Narrow setup tool selection is already in step 3. General environment changes can follow |

The first complete milestone does not need project discovery, autonomous workspace task completion, cross-Board publishing or custom dashboards. It does need the selected initiative policy to be real and controllable. Until then, cadence can be visibly pending, but setup cannot claim it has been applied.

This keeps board 1 first while acknowledging its small dependencies on resident families, scheduling and assistant tool selection. It does not require finishing every thread on boards 2, 4 and 5 before seeing useful progress.

## Changes that must travel together

- **Agents and Board:** package versions, adapter composition, fresh defaults and saved extension selections before resume. Board data stays intact.
- **Resident home and family:** home association, stable anchor, new-chat enrolment, continuing-resident authority and reliable addressing. Preserve older chats and their Boards instead of moving them implicitly.
- **Provenance:** composer, app-control, component-triggered and scheduled ingress, durable metadata, accepted-work linkage and the activity projection. A partial rollout must not guess that unknown input is human.
- **Snooze and producers:** the shared owner, Pulses admission, explicit agent nudges and reactivation. A control that only hides a button does not count.
- **Component activation:** installation receipt, target generation, idle handoff and one continuation. Inventory success alone does not mean the capability is usable.

Portable changes are built and packed in Pi Durable Components. Howcode adapters and SDK changes are built and packed in Howcode Components. Consume supported built packages, using content-hashed tarball names for the current sibling workflow. Regenerate shell registrations. Ordinary profile components use `howcode install` and the existing live-generation lifecycle. Do not introduce private-source aliases or duplicate Durable installs.

Current local tarball references are development inputs, not distributable release dependencies. Recheck the actual resolved package and profile inventory at implementation time. An absent app-root `node_modules` entry does not prove a dynamically installed profile component is absent.

## Validation when implementation is authorised

Use focused type, lint and build checks during implementation, then the repository's final gate once. Exercise UI and interaction changes in the running app with disposable workspaces. Do not add tests without Igor's explicit request, automate UI assertions or turn these developer checks into the assistant's wake routine.

The consequential practical checks are:

1. **Fresh and returning profiles:** no credentials, successful model setup, chosen home, direct first chat, preserved existing identities and selections.
2. **Headless lifecycle:** pending work and scheduled work after startup, backend crash without a browser, visible startup failure and clean generation replacement.
3. **Family continuity:** manual resident threads, resident-free chats, worker ownership, Context rollover, restart and missing-root recovery without data loss.
4. **Coordination:** local Board authority, remote contributions without local detachment, passive notices versus explicit messages, and old Board access after package migration.
5. **Pause semantics:** timed local and app-wide snoozes, indefinite halt with individual resumes, new workspaces under halt, deadlines ageing under restrictions, direct user work and accepted reporting.
6. **Catch-up:** several jobs across downtime, accurate missed-period metadata from tracked history, concurrency limits, provider backoff, obsolete definitions and no duplicated native submission.
7. **Awareness:** explicit enrolment, advisory policies, distinct human/Howcode/Git signals and graceful unavailability of optional capabilities.
8. **Environment and reminders:** exact-generation activation continuation, preserved artefacts, restart-safe reminder delivery and visibility on return.

## Technical decisions to settle at the start of the owning threads

These do not reopen product behaviour. They bound the implementation work before broad parallel changes begin.

- Finalise Board's host-enrolment, continuing-resident authority, additional-participation and optional Agents handoff contracts without a peer-service locator.
- Confirm the Durable metadata and transaction boundary for trusted origin, accepted-work linkage and retry-safe resident-target Pulse submissions.
- Specify the portable Pulses admission port and checkpoint changes, including definition revisions and what exact missed history can be recovered from existing records.
- Identify an actual provider-backoff signal the dispatcher can consume. Do not promise automatic backoff from unclassified error text.
- Specify the package-generation continuation receipt and the concrete component-state grant needed by awareness.

The next implementation assignment should be the bounded startup/recovery thread. The next cross-repository design work should settle the Board and admission contracts above. Neither requires another round of product questions.
