# Implementing assistant-first Howcode

This is the implementation companion to [Assistant-first Howcode](assistant-first.md). That document owns the agreed product behaviour. This one maps the changes, their owners and the order in which they can land. It is a proposal, not permission to begin implementation.

The first investigation covered seven areas across Howcode, Howcode Components and Pi Durable Components on 20 October 2026, starting at Howcode revision `4519f1f5`. Five further source investigations assessed feature gateways, durable delivery, trigger policy, package activation and public surfaces after the supplied harness talk. Current behaviour below is source-backed. Proposed contracts are not APIs that already exist.

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
| Time schedules and missed-period catch-up | Pi Durable Components, Pulses | Supply trusted input provenance, resident targets and lifecycle binding |
| Cross-source delivery | Existing Howcode Durable input/admission host, using native task and receipt primitives | Route feature-owned occurrences and validate accepted-work lineage |
| Proactive admission, adaptive timing and controls | A small Howcode Initiative component, proposed here | Compose one source-neutral policy port, with policy state, activity accounting and presentation owned by Initiative |
| Folder intent and workspace awareness | A Howcode awareness component | Existing workspace identity, activity projection and explicit enrolment |
| Package installation and activation | Existing Howcode package service | Narrow agent operations through the existing app-control dispatcher |
| Generated and persistent views | Existing UI and artefact components | Existing presentation slots and explicit host grants |

No new runtime, memory store, Board mirror or scheduler is proposed. A component-owned folder-policy record is configuration, not agent memory. The canonical setup narrative remains a Board thread.

## Feature gateways and reusable primitives

The supplied harness-talk transcript, `laptop:/home/igorw/Downloads/7Y4sbZgBdnc-transcript.txt`, makes two useful points. Exposed behaviour attracts dependencies under Hyrum's Law. Small primitives make features easier to ship and remove. Its concrete example is one subscription interface for events such as a message, a failed CI run or a time of day, rather than a separate integration pattern for each.

Apply that to the work here, without importing an entire new framework:

- Each feature owns its semantic operations, validation, state and lifecycle. Give it a supported gateway that the UI, agent tools and MCP can consume. Transport adapters translate calls and carry trusted caller context. They do not reimplement feature policy.
- Keep shared discovery and routing separate from feature behaviour. A compact `howcode` entry point must not become a central collection of Board, package, scheduling and workspace business rules. Never expose arbitrary internal service methods as a shortcut.
- Derive common subscription and delivery machinery from concrete consumers: timed initiative and component-activation continuation. Source state remains with its feature. Delivery must distinguish a passive notice, new work and continuation of accepted work.
- Expose intent and useful outcomes, with opaque references where needed. Callers should not need queue internals or process-generation choreography to configure initiative or wait for installation. Existing supported formats and inspection remain available where useful.
- Keep temporary model-behaviour workarounds local, attributable and removable. Record the behaviour they compensate for and a removal condition with the owning feature. Do not turn them into permanent product contracts or build a shim dashboard without a demonstrated need. Runtime reliability and explicit user policy are not such workarounds.

This refines the previous plan in two places. Pulses should not own every kind of wake-up merely because it owns timers. Component activation should not gain an unrelated setup-continuation queue. The owning threads must find the smallest shared boundary in the existing machinery, not design hypothetical Slack or CI integrations now.

### What the gateway assessment found

The SDK already allows feature-owned `tools` and `requests`. Requests are an untyped handler object dispatched by package and method. Native app-control and HTTP MCP share `executeAppControl`, but its workspace/chat action catalogue is hand-written. Bots has its own semantic request handlers. Board's Howcode adapter contributes no request handlers. These are separate entry paths, not evidence that domain rules have already been copied into multiple implementations.

The missing piece is explicit composition of supported feature operations. Add only the typed operation contribution needed to discover and route those operations: a namespaced identity, feature-owned validation and handler, and trusted caller context. Reuse the same feature operation and schema across its adapters where feasible. Do not build a second native-tool catalogue, automatically export every Durable tool, or publish the existing `requests` object wholesale.

Native agent routing must honour selected capabilities. Installation does not grant conversational access, and routing through `howcode` must not bypass that selection. MCP exposure is a separate explicit policy, not proof of human origin. The feature validates the operation using host-derived caller context regardless of transport.

Build the callable catalogue from active component instances, reject collisions and retire entries with their owning generation after admitted calls drain. Removing a capability reports it unavailable and preserves its user data. Pilot a real Bots or Board operation before expanding package administration. Do not migrate every existing renderer request merely for architectural symmetry.

Native IDs, Board membership, extension selections and documented user-authored formats are intentional contracts or actual data, not clutter to hide. Preserve them where they carry identity or authority. Hyrum's Law is a reason to choose a small public surface deliberately, not to remove useful controls, make inspection opaque or preserve every obsolete interface on this unshipped branch.

Source anchors: `../howcode-components/packages/sdk/src/plugins.ts:195`, `desktop/plugins/runtime.ts:372`, `desktop/durable-runtime/app-control-tool.ts:19`, `src/server/mcp.ts:41`, `../howcode-components/packages/bots/src/service.ts:69`, `../howcode-components/packages/board/src/service.ts:7`.

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

Bots should own the setup workflow and resident state. The shell supplies the first-run entry and opens the resulting ordinary conversation. Reuse host-owned model and authentication APIs. Replace the current name/instructions-first, default-workspace setup contract rather than preserving it as an unshipped compatibility interface. Preserve resident data, not obsolete workflow shapes. Do not create another setup identity in the shell or revive the previously rejected full-page assistant management screen.

Collect the agreed choices: model access, assistant home folder, launch preference and initiative mode. Support fixed timing, adaptive initiative and no scheduled generic initiative. Create or select the corresponding directory-backed workspace and persist its ID on the installation resident. Use a default identity and enter conversation without a naming or instruction-writing gate.

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
| Chosen initiative schedule | Pulses and its Howcode adapter |
| Cross-source admission, adaptive timing and snooze controls | The proposed Initiative component |

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

Installed Durable 1.3 already supplies task checkpoints, transactions, `TaskRuntime.sleep` and `Harness.waitForTask`. The sleep itself is an in-process cancellable timer. Recovery comes from rerunning the persisted task against its stored absolute deadline, not from retaining the timer registration. Commit subscriptions and the SDK's `publishEvent` are also process-local observers, not replayable durable subscriptions. A terminal task is not necessarily successful: delivery must inspect its real outcome.

Board's persisted subscriptions are feature-specific. Their notices remain passive and best-effort for active turns. Do not repurpose them as a universal wake-up service.

Source anchors:

- `../pi-durable-components/packages/pulses/src/state.ts:9`
- `../pi-durable-components/packages/pulses/src/index.ts:103`, `:333` and `:372`
- `../pi-durable-components/packages/pulses/src/schedule.ts:144`
- `../pi-durable-components/packages/pulses/src/tasks.ts:53`
- `../howcode-components/packages/pulses/src/service.ts:104` and `:275`
- Installed `node_modules/@earendil-works/pi-durable/dist/types.d.ts`, `dist/harness/types.d.ts` and `dist/harness/scheduler.js:1672`

### Proposed thread: trusted input origin and accepted work

Add a closed, host-derived input-origin contract at real ingress boundaries. Carry it through durable submission metadata and expose the necessary part to components.

Direct composer input is human-origin. Agent tools, scheduled work and ordinary MCP calls are not human-origin merely because they submit a user-role message. A bearer token authenticates a client, not a human decision. Message text, an `urgent` argument and a caller-supplied source flag cannot grant a snooze exemption.

Also retain accepted-work lineage. Source alone cannot distinguish an unrelated new nudge from a worker completing an already accepted task. Host/native-validated task or receipt linkage should allow accepted work and its settlement to finish. Do not use an agent-controlled `continuation: true` escape hatch. Do not count those continuations as new human activity.

This is admission accounting, not a new intent classifier or permissions framework. Standing instructions still govern whether an agent is proposing unrelated work. The mechanical boundary must prevent paused producers from submitting new proactive work and preserve already accepted work.

The same provenance feeds the workspace last-human-message projection. Today's `RuntimeOriginDoc` records workspace association, not input origin.

Source anchors: `desktop/durable-runtime/conversation-origin.ts:4`, `desktop/app-service/composer-actions.ts:53`, `desktop/durable-runtime/app-control/chat-actions.ts:46`, `../howcode-components/packages/sdk/src/plugins.ts`.

### Proposed thread: shared subscriptions and one admission owner

Put authoritative local and app-wide restrictions in a small Howcode Initiative component. This is the concrete feature for the already-agreed snooze and adaptive initiative controls, not a new permissions framework. It owns policy persistence, decisions, activity-based timing, scoped cards and Settings, independently of Bots and Pulses. Expose it through one typed, source-neutral admission port.

Pulses supplies time-based work, not the definition of every event or continuation. Component activation supplies its own outcomes. Both must reuse the durable delivery contract without making activation pretend to be a Pulse job. Accepted activation continuations retain their admission rather than becoming new proactive work.

Define the public contract before changing producers: source and target identity, subscription lifetime, delivery mode, current restrictions, admission result, accepted-work linkage, retry identity and reactivation. Feature owners provide events or observable conditions. Reconcile authoritative source state on recovery rather than assuming an in-memory callback is a durable subscription.

Keep subscription identity, cursor and result state with the source feature, using existing durable storage and task primitives where they fit. The shared part is a thin delivery boundary at Howcode's existing Durable input/admission host: stable occurrence identity, target, delivery intent and acquisition of the native receipt. Portable sources receive that capability through an explicit host port. Do not add a central event log, a ledger duplicating native submission receipts or peer-service lookup. Reacquire a previous receipt before admitting a retry as new work.

Use native task checkpoints and absolute deadlines for recoverable scheduled waits. Rebind source capabilities before recovery resumes. Waiting must not count as foreground activity that prevents the very component transition being observed. A missing feature can leave its task visibly blocked until restored, but must not erase accepted work or silently replay its external effects.

Use the existing SDK `admitInput` and host `beforeInput` composition as mechanical starting points. Their current conversation-ID-only signature is insufficient. Pulses already supplies a mandatory `admit` callback for new runs, but its Howcode adapter uses it to prepare workspace configuration. That callback runs before the native task transaction. Neither hook currently makes a pause change race-safe with new work acceptance.

The implementation must establish a shared commit boundary for a new admission and the policy state it checks. A successful preflight followed later by an unchecked submission is not enough. Preserve receipt rejoin before new admission and validate continuation lineage through the host. Checking a Pulse's parent configuration is not a substitute for admitting the Pulse's own work.

Core supplies provenance and lifecycle plumbing, not snooze policy. Removing Pulses leaves Initiative's restrictions intact. If Initiative itself becomes unavailable, participating proactive admission must stop visibly rather than treating a missing hook as permission. Preserve restrictions until the owner returns or the user deliberately resolves them. Direct user work and settlement of accepted work remain available. Unsupported producers must not claim to honour snooze. Trusted host code and arbitrary OS jobs can bypass Howcode, so this is not an isolation guarantee.

Source anchors: `../pi-durable-components/packages/pulses/src/contract.ts:35`, `../pi-durable-components/packages/pulses/src/index.ts:191`, `../howcode-components/packages/pulses/src/service.ts:136`, `../howcode-components/packages/pulses/src/configuration.ts:33`, `desktop/plugins/runtime.ts:88`.

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

### Proposed thread: fixed and adaptive initiative

Expose a scheduling-owned operation to configure fixed initiative in the main assistant's chosen home workspace. The operation must reuse the existing definition and schedule machinery. If it creates or updates `pulses/<id>/PULSE.md`, do so as the explicit requested configuration and report the managed definition. Keep existing user-authored Pulse files supported and preserve unrelated definitions. Do not require the caller to construct a file as the only public interface, or create a parallel schedule store.

This gateway is new work: the current public Pulses API offers catalogue, scan, run, observe and stop, but no cadence configuration operation. Its current bindings also resolve workspace bots rather than the separate installation resident. Use the explicit resident resolver and stable home association, not title matching or an invented bot identity.

Add a supported run target that submits to the continuing main resident. A passive report from a normal child Pulse does not wake that resident and is insufficient on its own. Keep child execution as the existing default for ordinary Pulse jobs. Both targets use the same scheduling, admission and native receipt machinery.

For adaptive mode, Initiative owns the next eligible generic check-in and an agent-facing tool to request a later or earlier internal deadline within the user's limits. Use the existing durable deadline and delivery machinery. Do not run a second model continuously to decide whether the resident should wake, create another scheduler or rewrite a recurring Pulse definition after every prompt.

The default levels are Off, Low at 2 hours, Normal at 1 hour and High at 30 minutes. Expose Initiative's editable intervals and post-prompt quiet period, initially 30 minutes, through Settings. Treat intervals as minimum gaps, not mandatory wake frequencies. Validate positive, ordered intervals. The agent can defer further, but cannot request a wake inside the effective minimum gap or bypass activity suppression and explicit restrictions. Timing preferences are user-facing. Individual deadlines, learned patterns and routine timer adjustments remain internal, without a new dashboard or chat narration.

### Proposed thread: learn when to leave the user alone

Feed Initiative the trusted human-prompt timestamps already needed for workspace awareness. Observe activity across the profile, not just the target resident, so working in one workspace does not look like absence to every other bot. Persist bounded timing aggregates rather than copying prompt content or creating an agent memory store. Agent inputs, Pulse messages and settlement reports do not count as human activity.

Recent activity suppresses generic initiative. Historical active hours also bias it down. Quiet periods create more opportunity for agents to work. The system must not interpret a high volume of prompts as a reason to become more proactive.

Use this as an initial tuning proposal, not a fixed product contract:

- Compare rolling 7-day and 28-day activity windows, initially weighted 60% and 40%.
- Use hourly activity slots. Count occupied slots rather than allowing a burst of prompts to dominate the pattern. Begin with weekday/weekend patterns and refine to individual weekdays when history supports it.
- A new human prompt suppresses generic check-ins for the configured quiet period. With the 30-minute default, an absence of 30 to 90 minutes permits Low during habitual active hours or Normal otherwise. After 90 minutes, habitual quiet hours can permit High, otherwise Normal. Keep this transition consistent if the quiet period is lengthened.
- Treat insufficient history as unknown, not evidence of absence. Live activity takes precedence over historical expectations.

These estimates only select an opportunity within user limits. Explicit snooze, halt and workspace policies still win. No browser tab or presence heartbeat is required. Activity-based Off suppresses generic check-ins, not an explicitly scheduled job, requested reminder or accepted work.

### Proposed thread: count scheduled work instead of waking twice

At the shared admission boundary, Initiative records per-scope proactive execution activity using the native occurrence or receipt identity. A Pulse or other proactive event admitted to run consumes the generic check-in opportunity for that scope. Rejoining the same receipt must not count it again or keep extending the interval. A future schedule, an unadmitted queued occurrence or a rejected admission earns no execution credit.

Update activity credit and check generic eligibility at the same race-safe acceptance boundary. Resolve already-due explicit work before admitting a generic wake for the same scope, rather than letting both independently pass stale checks. Suppress or postpone the generic request, preserve the explicit job, and admit no extra generic wake while the resident is busy. Do not cancel work already accepted before a later explicit job becomes due. This is different from deduplicating a retry of the same native submission or coalescing missed occurrences of a job. Distinct scheduled jobs retain their identities and timing.

For example, a Pulse admitted at 09:00 displaces a generic check-in due at 09:05. With a one-hour minimum gap, the next generic opportunity is no earlier than 10:00, and may be later because of activity, ongoing work, agent deferral or snooze. Credit does not assert that the job succeeded. Preserve its real outcome and reporting, and do not disguise failure as a reason to replay the job through a generic wake.

Persist enough accounting to survive restart alongside Initiative's policy state. Do not introduce a second execution ledger or standalone dedupe service. Generic adaptive opportunities are not a backlog of obligations: do not accumulate and replay every missed adaptive tick. Explicit scheduled jobs still use the agreed per-job catch-up rules.

Conversational sidequests remain ordinary continuing agent work. They do not need another periodic job or an open browser. Their wind-down and unrelated-work choices follow standing instructions, with the same accepted-work boundary when snooze begins.

**Completion evidence:** browser-independent fixed and adaptive initiative, editable timing limits, suppression during genuine user activity and correct handling of sparse history. A scheduled Pulse and a nearby generic check-in produce no redundant generic wake, including simultaneous admission and restart. Explicit jobs remain intact. Verify restart-safe due work, local/global restriction precedence, one coalesced run per explicit job with correct metadata, bounded catch-up, visible obsolete jobs and accepted work finishing without waking idle parents merely to report.

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

The package manager persists a fresh revision with committed inventory. Its exposed mutation returns component descriptors, not a durable operation receipt or request-deduplicated install result. `component-status.json` is a leased snapshot used by the CLI, not an activation event log. Renderer invalidation is volatile. None can simply be relabelled as reliable subscription delivery.

Full component activation can wait for active work and request leases to drain. There is no supported durable operation meaning "continue this setup after this exact component generation activates". A chat submission receipt does not supply that contract.

Service activation and renderer admission are separate stages. Headless agent work should wait for the service capability it needs, not for a browser to acknowledge a renderer. A request for a UI capability may need the latter stage too.

Visualise creates turn-bound views that freeze when the turn ends. It is not a persistent installed component. Existing artefact and component packages provide the durable presentation mechanisms.

Source anchors: `components/packages/service/ui.ts:256`, `desktop/package-cli.ts:72`, `components/packages/service/installed-components.ts:210`, `shared/app-control.ts:17`, `desktop/durable-runtime/extension-composition.ts:44`, `../howcode-components/packages/intelligent-ui/src/service.ts:103`.

Activation evidence: `components/packages/service/manager.ts:212` and `:269`, `components/packages/service/component-status.ts:8`, `components/packages/service/installed-components.ts:207` and `:351`, `desktop/service-host-runtime.ts:169`.

### Proposed threads: narrow administration and activation continuation

Expose typed inventory, installation and activation-status operations from the package feature's own gateway. The existing app-control catalogue may discover and route those supported operations, but the package service remains their implementation. UI, native agent tools and MCP use that same owner. Expose per-conversation extension selection through the existing Durable selection path. Do not add generic service RPC, another installer or a second MCP implementation.

Installation receipts must distinguish installed inventory from a usable capability. Let callers subscribe to the outcome of that installation through the shared durable delivery contract. Internally correlate the exact intended revision and originating conversation. The agent yields, the package owner reaches its idle activation boundary, and accepted setup work resumes once after activation or receives an explicit failure. The package owner remains authoritative for the outcome. Do not add a separate setup queue, or wait for idle while holding the very turn or request lease that prevents it.

The package operation needs a durable receipt that identifies the committed source and revision. Close the snapshot/subscribe race with registration and a revision recheck or equivalent reconciliation. After restart, inspect the exact operation and source state rather than reinstalling. Report failed, removed and superseded targets explicitly. Do not quietly continue on a different generation, and do not assume `waitForTask` observes activation when the package lifecycle is not a native task today.

Capability removal or failed activation needs an explicit result. Retrying setup must inspect the original install receipt rather than reinstalling or repeating external setup side effects. This continuation also needs the accepted-work classification from the admission work.

Keep generated views and installable components distinct in instructions. A requested temporary panel can use Visualise. A persistent page or new host capability belongs in an installed component using existing SDK grants. Preserve producer-owned artefacts and version history. Do not add a mandatory to-do panel.

Audit `WorkspaceLayoutTools` during this ownership work: it is currently registered unconditionally in core. Its presentation policy should move behind the owning layout capability rather than being copied into a new assistant-control layer. Existing per-chat layout records and workspace defaults must survive that move.

**Completion evidence:** installation during a turn reports pending, yields, and continues on the exact active service revision without repeating installation or waiting for an absent browser. Requests for renderer readiness remain distinct. Restart, failure and supersession produce the right outcome without an idle-blocking waiter. Changing tool selection does not change renderer visibility. A generated view is not misreported as a package install.

## 8. Add reminders as reminders

There is no general reminder/deadline record today. The conversation inbox tracks unread assistant notifications, not due work. It cannot be relabelled to satisfy the requirement.

Add persistent one-shot due records referencing the relevant chat or Board thread, with a Howcode-owned on-return presentation. Reuse the subscription, scheduling and admission machinery where appropriate, but keep reminder delivery distinct from starting a Pulse work conversation. A due notification should not silently become an instruction to perform the underlying task.

Specify restart-safe delivery and acknowledgement, and preserve the reminder while the user is away. Use the existing inbox as a delivery surface if it fits, not as a substitute for the due record. External channels remain installable capabilities requested separately.

This is a small work item under scheduling, not a new task-management product or a second scheduler.

Source anchor: `desktop/chat-repository/schema-sql.ts:43`.

## Delivery order

The five proposed workboards in the product plan still fit, but they are not independent implementation batches.

| Order | Threads | Dependency and stopping point |
| --- | --- | --- |
| 1 | Eager startup and backend recovery | Can land with current component versions. Proves reliable runtime, not complete assistant setup |
| 2 | Agents/Board dependency alignment, public local enrolment and stable resident anchors | Must precede relying on standalone Board and new continuing-family behaviour. Pilot a feature-owned operation here before expanding the shared router |
| 3 | Fresh defaults, Bots setup, chosen home, direct conversation and setup Board thread | Needs the Board foundation and existing model/workspace host ports |
| 4 | Trusted origin and accepted-work linkage, shared delivery, Initiative policy/activity accounting and Pulse catch-up | Prove the shared boundary against scheduled work and the existing package lifecycle. Full agent package administration can still follow later |
| 5 | Main-resident target, fixed/adaptive timing, editable preferences and actual launch setup | Joins runtime, setup and controlled scheduling into the first complete assistant-first experience |
| 6 | Optional workspace resident enrolment and cross-Board coordination | Uses the same family foundation and admission boundary |
| 7 | Discovery, policies, activity overview and reminders | Awareness needs provenance and resident routing. Reminder delivery needs the due path |
| 8 | General package control, activation continuation and persistent custom surfaces | Narrow setup tool selection is already in step 3. General environment changes can follow |

The first complete milestone does not need project discovery, autonomous workspace task completion, cross-Board publishing or custom dashboards. It does need the selected initiative policy to be real and controllable. Until then, cadence can be visibly pending, but setup cannot claim it has been applied.

This keeps board 1 first while acknowledging its small dependencies on resident families, scheduling and assistant tool selection. It does not require finishing every thread on boards 2, 4 and 5 before seeing useful progress.

## Changes that must travel together

- **Agents and Board:** package versions, adapter composition, fresh defaults and saved extension selections before resume. Board data stays intact.
- **Resident home and family:** home association, stable anchor, new-chat enrolment, continuing-resident authority and reliable addressing. Preserve older chats and their Boards instead of moving them implicitly.
- **Provenance:** composer, app-control, component-triggered and scheduled ingress, durable metadata, accepted-work linkage and the activity projection. A partial rollout must not guess that unknown input is human.
- **Initiative and producers:** policy state, trusted prompt activity, editable timing limits, race-safe admission/credit, time and other proactive sources, explicit agent nudges and reactivation. Missing policy must not silently resume work. A control that only hides a button does not count.
- **Component activation:** feature-owned installation receipt and outcome, target generation, idle handoff and shared delivery of one accepted continuation. Inventory success alone does not mean the capability is usable.

Portable changes are built and packed in Pi Durable Components. Howcode adapters and SDK changes are built and packed in Howcode Components. Consume supported built packages, using content-hashed tarball names for the current sibling workflow. Regenerate shell registrations. Ordinary profile components use `howcode install` and the existing live-generation lifecycle. Do not introduce private-source aliases or duplicate Durable installs.

Current local tarball references are development inputs, not distributable release dependencies. Recheck the actual resolved package and profile inventory at implementation time. An absent app-root `node_modules` entry does not prove a dynamically installed profile component is absent.

## Validation when implementation is authorised

Use focused type, lint and build checks during implementation, then the repository's final gate once. Exercise UI and interaction changes in the running app with disposable workspaces. Do not add tests without Igor's explicit request, automate UI assertions or turn these developer checks into the assistant's wake routine.

The consequential practical checks are:

1. **Fresh and returning profiles:** no credentials, successful model setup, chosen home, direct first chat, preserved existing identities and selections.
2. **Headless lifecycle:** pending work and scheduled work after startup, backend crash without a browser, visible startup failure and clean generation replacement.
3. **Family continuity:** manual resident threads, resident-free chats, worker ownership, Context rollover, restart and missing-root recovery without data loss.
4. **Coordination:** local Board authority, remote contributions without local detachment, passive notices versus explicit messages, and old Board access after package migration.
5. **Pause semantics:** timed local and app-wide snoozes, indefinite halt with individual resumes, new workspaces under halt, deadlines ageing under restrictions, direct user work and accepted reporting. Include pause/admission races and a missing policy owner without silently resuming work.
6. **Catch-up:** several jobs across downtime, accurate missed-period metadata from tracked history, concurrency limits, provider backoff, obsolete definitions and no duplicated native submission.
7. **Awareness:** explicit enrolment, advisory policies, distinct human/Howcode/Git signals and graceful unavailability of optional capabilities.
8. **Environment and reminders:** exact-generation activation continuation, service versus renderer readiness, failure and supersession, no idle-blocking waiter, preserved artefacts, restart-safe reminder delivery and visibility on return.
9. **Gateways and removal:** the same feature operation through supported UI, native-agent and MCP routes, correct caller authority and selection, no raw-request exposure, and capability removal without deleting its data or breaking unrelated chat.
10. **Adaptive initiative:** prompts in another workspace still suppress generic wakes, agent messages do not train human activity patterns, editable intervals survive restart, sparse history does not imply absence, and the agent cannot shorten user limits. A Pulse consumes one generic opportunity without cancelling distinct jobs or counting receipt retries again.

## Technical decisions to settle at the start of the owning threads

These do not reopen product behaviour. They bound the implementation work before broad parallel changes begin.

- Finalise Board's host-enrolment, continuing-resident authority, additional-participation and optional Agents handoff contracts without a peer-service locator.
- Settle the SDK's explicit feature-operation contribution and trusted-caller contract before expanding app-control or MCP. Reuse owning schemas and handlers, retain agent selection and keep raw plugin requests private.
- Confirm the Durable metadata and transaction boundary for trusted origin, accepted-work linkage and retry-safe resident-target Pulse submissions.
- Finalise the host delivery port and Initiative's policy contract against concrete Pulses and activation sources, including atomic new admission and policy-owner loss. Keep Pulse checkpoint changes, definition revisions and recoverable missed history with Pulses.
- Specify Initiative's bounded prompt-time aggregates, adjustable timer operation and atomic per-scope activity credit. Keep the proposed learning weights and transitions replaceable, separate from user timing limits and fixed job schedules.
- Identify an actual provider-backoff signal the dispatcher can consume. Do not promise automatic backoff from unclassified error text.
- Specify the package-owned activation receipt and its subscription boundary, feature-gateway discovery and the concrete component-state grant needed by awareness.

The next implementation assignment should be the bounded startup/recovery thread. The next cross-repository design work should settle the Board and admission contracts above. Neither requires another round of product questions.
