# Howcode vs Afreet

Investigated 17/10/2026. This is an implementation ledger, not permission to implement everything in it.

For the current delivery queue, see [Release readiness](release-readiness.md). Several gaps recorded below have since been delivered. Keep the original findings tied to their inspected revisions.

## Bottom line

Howcode already has durable chats, resident bots, workers, scheduled pulses, notebook execution, People, generated interfaces, artifacts, Git review and flexible docking. Rebuilding those would waste the day.

The substantial gaps are complete resident-memory workflows, discoverable cross-workspace coordination, attention and reminders, webhook-triggered work, conversational voice, structured human questions, and several context/provider controls. Some underlying engines already exist in our Durable packages. They still need host integration, not another implementation.

One baseline problem surfaced during practical inspection:

**Dictation's settings fail despite a Ready badge.** Opening its component settings displayed `Unknown plugin request: getSettings`. Both the installed package and current source declare that request. The cause has not been established. Separately, the current LAN HTTP address cannot capture a microphone.

Attachment cleanup is an accepted product difference, provided the conversation remains continuable. Howcode removes temporary uploads after 14 days. Source tracing shows replay does not require reopening original attachment paths, although reading or downloading a deleted original is no longer possible. Continuation after cleanup was not exercised live. Durable original-file retention is not a requested parity requirement.

Literal parity is not a credible one-day promise. Voice, webhook admission and provider-native context behaviour each cross consequential lifecycle boundaries. A useful parity slice today is realistic if we reuse the existing components and stop confusing package availability with working product integration.

## What was compared

| Target | Baseline |
| --- | --- |
| Howcode | `durable`, `2d3f7a69`, including the existing uncommitted People implementation |
| Howcode components | `a51960d`, including existing uncommitted author-label and navigation changes |
| Durable components | `9e4713f`, clean at inspection |
| Afreet reference | Local `384d886`, dated 01/10/2026. User-owned checkout, no remote configured, left unchanged |
| Running Howcode | Dev profile at `http://192.168.0.113:5173` |
| Running Afreet | `https://127.0.0.1:43871`. Its self-signed certificate produced a browser warning |

The source comparison uses the checked-out Afreet revision. Its running UI was also inspected, but its backend build identity was not independently established. This is not a claim about a newer upstream Afreet.

The supported Howcode package-list command and running Components screen confirmed **14 ready UI components**, including Bots, Agents and Pulses. Notebook is also installed. Those four capabilities are not all part of the fresh-install seed. People is an in-repository component wired directly into settings, send admission and chat presentation. It does not need an external package-registration entry.

The current Agents package uses Durable Agents **0.5.0**, which still bundles Board. The newer standalone Board source is not the installed implementation. Do not install it beside the old bundled version and assume the migration is done.

### Reading the ledger

- **Present:** an implemented counterpart exists. This does not imply every failure path was exercised live.
- **Partial:** a useful part exists, but the stated workflow is incomplete.
- **Missing:** no implemented Howcode counterpart was found in the current composition.
- **Integration:** reusable sibling code exists, but is not connected to this app/profile.
- **Different:** an intentional architecture or interaction difference, not automatically a defect.
- **Neither:** not established as implemented in either product. Afreet's thesis is not a shipped feature list.

Source prefixes below are relative to `/home/igorw/Work`: `H` is `howcode`, `HC` is `howcode-components`, `D` is `pi-durable-components`, and `A` is `afreet`. Line anchors identify the inspected revision. Evidence groups are listed after each table.

## Workspaces, chats and attention

| ID | Capability | Howcode against Afreet | Status |
| --- | --- | --- | --- |
| W01 | Create a folder-backed workspace | Existing folder, new folder and Git source workflows exist. Afreet combines Project/Bot creation with first-chat creation. Howcode also has folderless chat groups. | Present, different setup |
| W02 | Resident bot per workspace | Optional Bots component supplies identity and a main chat. It is installed and visible here. | Present |
| W03 | Installation-wide operator | Afreet has a reserved operator resident for global coordination. Howcode has no equivalent configured installation resident or complete global control tools. | Missing |
| W04 | Rename and organise | Workspace/chat naming, collapse, sorting and favourites exist. | Present |
| W05 | Move a workspace's backing folder | Afreet coordinates an idle workspace move and updates chat paths. Howcode's chat-group reassignment is not a filesystem move. | Missing |
| W06 | Archive and restore a whole workspace | Afreet retains chats, files, resident and pulse records while removing the workspace from active scheduling. Howcode's directory deletion is a separate, potentially destructive operation. | Missing |
| W07 | Move a chat between groups | Howcode supports transactional group reassignment. No equivalent Afreet chat-transfer UI was found. Moving membership does not move the filesystem or automatically redefine context ownership. | Howcode extra |
| W08 | Git branches and worktrees | Howcode has branch assignment, creation, switching, worktree creation, merge and cleanup workflows. Afreet's inspected UI does not provide equivalent controls. | Howcode extra |
| W09 | Global message-content search | Afreet searches across chats/workspaces and opens the exact historical match. Howcode navigation searches names/titles; Past chats also searches summary/branch/worktree metadata. | Missing |
| W10 | Find inside one conversation | Howcode searches the full stored conversation, loads older hits, unfolds and highlights them. Afreet's global search also deep-links into historical content. | Present |
| W11 | Explicit chat archive and restore | Howcode has restorable archive, permanent deletion and bulk operations. Past chats is a separate age-based view, not the archive. | Present |
| W12 | Done, reopen and snooze | Afreet has Done, reopen, 1/3/7-day reminders and attention categories. Done chats auto-archive after seven days; a pinned resident cannot be marked done. Howcode archive/favourite/unread are not these states. | Missing |
| W13 | Active attention navigation | Afreet separates working, idle, needs-attention, reminders, finished and archived. Howcode has workspace lists and a durable Inbox, but not the same attention workflow. | Partial |
| W14 | Durable unread Inbox | Howcode persists the latest completed reply's unread/dismissed state and offers reply/dismiss. Afreet's Active list and parent signals are different. | Howcode extra |
| W15 | Fork a transcript at an earlier entry | Howcode `/fork` creates a new Durable conversation without rewriting the original. Afreet child delegation is not a transcript fork. | Howcode extra |
| W16 | Edit an old message or regenerate a prior answer | No complete prior-turn edit/regenerate workflow was established in either. Failed-send draft restoration is not history editing. | Neither |
| W17 | Queued input, steering and Stop | Both support busy-input routing and stopping work. Howcode adds a visible cancellable queue and global Steer/Queue/Stop behaviour. Queue editing/reordering was not found. | Present |
| W18 | Drafts and failed-send recovery | Both retain failed input. Howcode preserves newer typing while clearing only the submitted snapshot, including attachments. | Present |
| W19 | Persistent Simple/Detailed presentation | Afreet changes timeline/progress and composer-control density, with workspace state and a global creation default. Howcode's turn folding is a narrower control. | Missing |
| W20 | Fold turns and tools | Howcode provides turn/tool disclosure, fold-all and history navigation. A Simple mode should reuse these rather than replace the renderer. | Present |
| W21 | General chat with durable territory | Folderless groups exist. They do not automatically provide a shared backing folder, pulses and workspace-owned memory. Afreet's workspace has a real cwd. | Partial |

Evidence:

- `A/src/workspaces/contract.ts:47`, `A/src/web/workspace-dialog.tsx:17`, `A/src/web/use-chat-directory-workspace-actions.ts:40`, `A/src/extensions/bundled/help/pages/managing-workspaces.md`.
- `H/desktop/workspace-repository.ts:37`, `H/desktop/chat-repository/workspace-organization.ts:51`, `H/components/working-directories/service/actions/directory-actions.ts:104`.
- `HC/packages/classic-navigation/src/workspaces/useWorkspaceNavigationController.ts:47`, `HC/packages/classic-navigation/src/history/chat-history-model.ts:22`, `H/shared/chat-search.ts:10`, `H/desktop/app-service/chat-loader.ts:72`.
- `A/src/chats/sqlite-conversation-search.ts:24`, `A/src/web/use-chat-search-navigation.ts:23`, `A/src/web/sidebar-chat-actions-menu.tsx:18`, `A/src/chats/lifecycle.ts:3`.
- `H/src/app/archive/archived-chats-view.tsx:101`, `H/desktop/chat-repository/conversation-projection.ts:5`, `H/desktop/chat-repository/inbox-writes.ts:17`, `H/src/app/inbox/inbox-chat-content.tsx:19`.
- `H/desktop/conversation-runtime.ts:128`, `HC/packages/composer/src/composer-submission-runner.ts:90`, `HC/packages/composer/src/composer-conversation-fork-panel.tsx:32`, `A/src/web/workspace-main.tsx:103`.

## Residents, people and continuity

| ID | Capability | Howcode against Afreet | Status |
| --- | --- | --- | --- |
| R01 | People directory and speaker selector | Names, descriptions, per-tab selection, validation and saved author snapshots exist. Previous practical validation covered independent tabs and historical labels after rename/removal. | Present |
| R02 | Bot persona across workspace chats | Howcode injects the bot name/instructions across its workspace chats and supports model-facing identity edits. | Present |
| R03 | Workspace-owned living identity | Afreet reads and watches `.afreet/bot/me.md` and `working.md`. Howcode stores name/instructions/avatar in app-data JSON. | Partial |
| R04 | Human relationship memory | Afreet's `.afreet/humans.md` is distinct from global People. Howcode has global People but no corresponding managed relationship document workflow. | Missing |
| R05 | Related-workspace memory | Afreet's `.afreet/workspaces.md` records relationships and context. No managed counterpart found. | Missing |
| R06 | Inspect/edit identity and working documents | Afreet Bot panel exposes Me, Humans, Workspaces and Working. Howcode has an identity form, not these document owners. | Partial |
| R07 | Identity revision history and restore | Afreet exposes Git-backed Me/Humans revisions. Howcode revision numbers prevent stale edits but are not inspectable historical versions. | Missing |
| R08 | Remember and close | Afreet reconciles a chat into canonical memory owners, then closes it. Howcode Memorise compacts a secondary chat and passively writes context to the main chat, leaving the source open. | Partial |
| R09 | Promote an existing chat to resident | Afreet can pin an existing idle chat. Howcode creates a new main or replacement, rather than selecting an arbitrary existing chat. | Missing |
| R10 | Activate/deactivate/remove a bot | Howcode exposes these controls and preserves chats/files. Do not replace them just to mimic Afreet's extension selection. | Present |
| R11 | Static image and animated bot appearance | Afreet supports workspace PNGs and state-based sprites. Howcode currently renders an avatar string as text/emoji. Neither establishes a graphical avatar editor. | Partial |
| R12 | Layered instructions and skills | Global/workspace instructions, conversation instructions, bot persona and selected skill content are supported. | Present |
| R13 | Virtual notes and targeted retained-history tools | Afreet's Context Management uses remote, workspace-shared records. Howcode's current profile lacks Context. Durable Context already supplies local notes/history, with different sharing/storage semantics. | Integration |
| R14 | Checkpoint-driven clean context windows | Afreet supports notes-first rollover without resetting the notebook. Durable Context supplies a reusable policy, but is not bound into Howcode admission. | Integration |
| R15 | Context budget available to the model | Afreet exposes `get_context_remaining` even without its Context extension. Howcode's UI meter is not an agent-callable tool. Durable Context has a counterpart. | Integration |

File-based resident memory and virtual Context notes are separate features. Implementing R03-R08 does **not** require adopting R13-R14 first. Keep their owners and storage semantics explicit.

Evidence:

- `H/components/people/ui/people-settings.tsx:7`, `H/components/people/ui/speaker-selection.ts:4`, `H/components/people/service/state.ts:7`, `H/components/people/service/entry.ts:4`.
- `HC/packages/bots/src/storage.ts:5`, `HC/packages/bots/src/service.ts:38`, `:116`, `:148`, `:201`, `:227`, `HC/packages/bots/src/renderer.tsx:21`, `:322`.
- `A/src/extensions/bundled/bot/identity.ts:22`, `A/src/extensions/bundled/bot/server.ts:31`, `A/src/extensions/bundled/bot/documents.ts:19`, `A/src/extensions/bundled/bot/history.ts:12`, `A/src/bots/memory-agent.ts:24`, `A/src/bots/promotion.ts:10`.
- `A/src/workspaces/native-files.ts:5`, `A/src/extensions/bundled/help/pages/workspace-context.md`, `A/src/extensions/bundled/help/pages/bot-appearance.md`.
- `H/components/agent-resources/service/index.ts:39`, `A/src/extensions/bundled/context-management/README.md`, `D/packages/context/README.md`, `D/packages/context/src/index.ts:68`.

## Workers and communication

| ID | Capability | Howcode against Afreet | Status |
| --- | --- | --- | --- |
| C01 | Persistent child agents | Current Agents component has workers, nested ownership, transcript inspection, messaging and Stop. | Present |
| C02 | Synchronous and asynchronous assignments | Installed Durable Agents has durable dispatch receipts, completion reporters and watches. Afreet also distinguishes acceptance from completion. | Present |
| C03 | Message a known peer conversation | Installed Agents 0.5 can send/assign to an exact host conversation ID, including non-worker conversations. Idle wake and busy steering exist. | Present |
| C04 | Find a resident by workspace/bot name | Afreet lists and resolves workspace/chat/bot targets with ambiguity checks. Howcode worker discovery does not expose a friendly global resident directory. | Missing |
| C05 | Passive peer message without waking | Afreet exposes `wake:false`. Howcode has host-side passive context writes, but no equivalent general peer option established in its installed agent tool. | Partial |
| C06 | Board channels, threads and subscriptions | Present through the legacy bundled Agents dependency. Afreet has no equivalent Board implementation found. Separate current Board package is not installed. | Howcode extra, version-sensitive |
| C07 | Guaranteed responsibility record across absence | Afreet's thesis explicitly calls this a missing core. Concrete chats, tasks and pulse records do not establish a universal accepted/blocked/settled contract in either app. | Neither |
| C08 | Browser/OS push while the app is closed | No push service, Notification API workflow or external delivery guarantee established in either. Durable in-app catch-up is not push. | Neither |

Evidence: `HC/packages/agents/src/service.ts:26`, `:41`, `:111`; its installed `node_modules/@howaboua/pi-durable-agents/README.md:40` and `dist/index.js:1341`; `A/src/tools/builtins/afreet-directory.ts:19`, `:100`; `A/src/tools/builtins/afreet-chat-messages.ts:53`; `A/src/chats/subagent-coordination.ts:120`; `A/src/operator/runtime.ts:39`; `A/docs/product-thesis.md:69`.

## Pulses and event-driven work

| ID | Capability | Howcode against Afreet | Status |
| --- | --- | --- | --- |
| P01 | Folder-owned pulse definitions | Both use `pulses/<id>/PULSE.md`. Afreet requires a non-empty sibling AGENTS.md; Howcode accepts it optionally. Frontmatter contracts differ. | Present, different contract |
| P02 | Manual, interval, daily, weekly, one-time schedules | Both implement these families, local-time scheduling and five-minute scanning. No independent per-pulse timezone selector established. | Present |
| P03 | Quiet hours and paused definitions | Both defer scheduled work. Howcode pause is currently an `enabled:false` file edit. | Present |
| P04 | Enable/disable through the pulse tool | Afreet exposes enable/disable; Howcode's `workspace_pulses` exposes list/run/stop, not enable/disable. Afreet's browser panel is not a full toggle editor either. | Partial |
| P05 | Run a disabled pulse manually | Afreet permits it; Howcode rejects disabled definitions. This needs an explicit product decision, not a silent parity change. | Different |
| P06 | Fresh chat for every run | Afreet supports `fresh` and `continuous`. Howcode reuses one persistent conversation per pulse, replacing it when ownership changes. | Missing |
| P07 | Per-run history with exact outcome | Afreet stores timing, status, summary/error, chat and webhook provenance. Howcode exposes task activity and conversation history, not an equivalent run-summary ledger. | Partial |
| P08 | Notify and wake the resident on settlement | Afreet durably steers the parent and recovers pending relays. Howcode writes passive parent context and deliberately does not wake it. | Different, material workflow gap |
| P09 | Explicit pulse Stop | Howcode exposes Stop and joins native cancellation. Afreet relies on the worker chat's Stop rather than a pulse-specific stop operation. | Howcode extra |
| P10 | Idempotent manual run admission | Howcode uses stable request IDs and joins existing tasks. Afreet's manual-run request has no equivalent caller key, so a retry after settlement can start another run. | Howcode extra |
| P11 | Restart and missed-slot handling | Both have persistence and avoid replaying a discovery backlog. Afreet interrupts ordinary runs on restart and retries interrupted webhooks; Howcode uses native Durable task recovery. Equivalent storage does not mean identical side-effect replay policy. | Present, different recovery |
| P12 | Webhook-triggered pulses | Afreet has named webhook routes, durable admission, delivery deduplication, bounded queues and untrusted payload handling. Howcode has no composed equivalent. | Missing |
| P13 | Receiver configuration and connection instructions | Afreet Settings offers receiver selection and Tailscale Funnel setup. Running reference had it disabled. Howcode has no receiver setup surface. | Missing |

Evidence:

- `A/src/pulses/definitions.ts:91`, `A/src/pulses/schedule.ts:24`, `A/src/pulses/runtime.ts:115`, `:153`, `:201`, `:224`, `A/src/pulses/sqlite.ts:96`, `:113`, `:264`, `A/src/pulses/webhooks.ts:23`.
- `A/src/pulses/execution.ts:17`, `A/src/pulses/delivery.ts:4`, `A/src/pulses/contract.ts:63`, `A/src/web/workspace-pulses.tsx:83`, `A/src/tools/builtins/afreet-pulse-contract.ts:16`.
- `HC/packages/pulses/src/catalog.ts:5`, `HC/packages/pulses/src/configuration.ts:16`, `HC/packages/pulses/src/service.ts:104`, `:151`, `:162`, `:275`, `HC/packages/pulses/src/renderer.tsx:91`.
- `D/packages/pulses/src/definitions.ts:48`, `D/packages/pulses/src/index.ts:186`, `:328`, `D/packages/pulses/src/tasks.ts:58`, `:128`, `D/packages/pulses/README.md`.

## Agent tools and extensibility

| ID | Capability | Howcode against Afreet | Status |
| --- | --- | --- | --- |
| T01 | Persistent notebook and in-cell tool discovery | Installed Notebook supplies `exec`, `wait`, `notebook`, `tools` and `ALL_TOOLS`. | Present |
| T02 | Shell execution and persistent commands | Notebook supplies `exec_command`/`write_stdin`. Coding conversations also have Durable `bash`. | Present |
| T03 | Basic file tools | The selectable CodingTools extension supplies `read`/`write`/`edit`; the attachment extension supplies attachment-authorised `read`/`ls`. These are capabilities, not conversation modes. Selection must be checked per conversation. | Present |
| T04 | `apply_patch` | Not in the current installed composition. A ready exported Durable extension exists. | Integration |
| T05 | Local image inspection | Afreet has `view_image`. Durable provides a reusable tool factory; Howcode does not compose it here. Model image attachments are not that tool. | Integration |
| T06 | Web search/browse | Afreet has `web__run`. Durable Web exists but needs authenticated Models/transport wiring. Ordinary shell networking is not equivalent search tooling. | Integration |
| T07 | Image generation and editing | Afreet has `image_gen__imagegen`. Durable Imagegen exists and needs Models plus conversation access for recent-image edits. | Integration |
| T08 | Agent-visible workspace/chat/control/settings operations | Afreet exposes these product tools. Howcode has UI/internal APIs and narrow bot/pulse/layout tools, not the same general directory/control catalogue. | Partial |
| T09 | Extension authoring check | Afreet `extensions.check` validates extension surfaces. Howcode has build/package checks but no equivalent model-facing authoring operation found. | Missing workflow |
| T10 | Skill browsing, management and injection | Howcode has a Skills component, file-backed resources and composer suggestions. Exact Afreet `skills` tool contract is not composed merely by showing that UI. | Present workflow, different tool surface |
| T11 | Git review | GitOps diff review and comments exist, alongside `git_diff`. Afreet's `comment_diff` has a different tool contract. | Present |
| T12 | Agent-generated custom interfaces | Howcode `visualise` creates/edits persistent HTML/CSS/JS output with preview validation. Not missing. | Present |
| T13 | Structured inline rich display | Afreet has collections, tables, reports, charts/Mermaid, media, sources, decisions and forms with a stable display schema. Howcode custom previews and ordinary Markdown are not the same structured presentation contract. | Partial |
| T14 | Durable blocking human question/form | Afreet's display tool can wait through `context.interact`; nonblocking interactions can queue a reply or be skipped. Howcode's preview sandbox has no equivalent generic response/admission channel. | Missing |
| T15 | Provider-visible context inspector | Afreet has a dedicated context snapshot/content surface. Howcode has token/context statistics and a host transcript projection, not an equivalent prompt/tool-context inspection pane. | Partial |
| T16 | Install trusted packages | Howcode supports local/Git/npm packages, UI settings and CLI lifecycle, explicit updates, live registry generations and errors. | Present |
| T17 | Workspace-scoped source-folder extensions | Afreet discovers bundled/global/workspace source folders and their runtime/server/UI/resource surfaces. Howcode installs profile packages and selects capabilities separately. | Different, authoring gap |
| T18 | Automatic source publication | Afreet watches and publishes extension changes with last-known-good state. Howcode local package edits require their supported build/update path; an existing module is not reloaded just because a source file changed. | Different |
| T19 | Extension-produced immutable context references | Afreet's resource picker searches selected extensions and attaches snapshots explicitly on Send. Howcode file/skill references do not supply this generic resource-catalogue seam. | Missing |
| T20 | Runtime choice for a new chat | Afreet exposes Code/Notebook execution defaults. Howcode can select installed extensions, but has no equivalent dedicated runtime-default workflow in the inspected UI. | Partial |
| T21 | Help tools | Afreet has `help.read`/`help.show`. No equivalent agent-facing product help capability found in Howcode. | Missing |

**Important integration boundary:** several Durable packages export factories, not ready extension objects. Installing their directory alone does not provide Models, conversation access, storage binding or audio ownership. Howcode deliberately does not synthesize tools from arbitrary library factories. Use a small feature-owned adapter through public contracts.

Durable Settings is a component-preferences library. It is **not** an already implemented equivalent of Afreet's agent-facing settings/control tool.

Evidence:

- `A/src/tools/builtins/index.ts:37` is the complete built-in composition. Bundled additions include `skills`, `help.read`, `help.show`, `tools.display.render`, `comment_diff`, plus selected Context tools.
- `H/desktop/durable-runtime/extension-composition.ts`, installed `H/node_modules/@earendil-works/pi-durable/dist/tools/index.js:11`, `H/components/attachment-tools/service/index.ts`, `H/desktop/durable-runtime/packages.ts:225`, `:318`.
- `D/packages/notebook/src/index.ts:86`, `D/packages/notebook/src/execution-runtime.ts:115`, `D/packages/apply-patch/src/index.ts:155`, `D/packages/view-image/src/index.ts:43`, `D/packages/web/README.md`, `D/packages/imagegen/README.md`, `D/packages/settings/README.md`.
- `HC/packages/intelligent-ui/src/service.ts:103`, `HC/packages/intelligent-ui/src/contracts.ts:32`, `HC/packages/intelligent-ui/src/preview.ts:4`, `A/src/extensions/bundled/rich-display/tools/render.ts:4`.
- `A/src/extensions/runtime/discovery.ts:51`, `A/src/extensions/runtime/publication.ts:21`, `A/src/extensions/runtime/ui-compiler.ts:77`, `A/src/web/composer-resources.tsx:23`.
- `H/components/packages/service/manager.ts:110`, `H/desktop/durable-runtime/live-extensions.ts:13`, `H/desktop/durable-runtime/context-transcript.ts:35`, `A/src/extensions/bundled/context-inspector/ui.json`.

## Models, context and recovery

| ID | Capability | Howcode against Afreet | Status |
| --- | --- | --- | --- |
| M01 | Provider account login | Howcode has browser-owned OAuth/API-key flows, account state and logout through Pi Models. Afreet targets ChatGPT. | Present, Howcode broader |
| M02 | Provider/model/thinking selection | Present per conversation, with application defaults and custom provider configuration. No reason to replace it with a fixed OpenAI-only core. | Present |
| M03 | Economy/Marathon/Power presets | Afreet supplies approachable preset combinations. Howcode exposes underlying model/reasoning choices, not these workload presets. | Missing convenience |
| M04 | Per-chat context-budget tiers | Afreet offers 272k/472k/872k compaction boundaries. Howcode exposes auto-compaction on/off, not per-chat budget controls. Model context-window overrides are not the same setting. | Missing |
| M05 | Faster replies | Afreet has a priority-service control. Stock Pi supports provider service-tier options, but Howcode does not expose/plumb a matching chat control. | Integration |
| M06 | Explicit paid cache keepalive | Afreet schedules isolated completions and exposes the spend choice. Cached WebSocket transport does not provide this. No corresponding Howcode scheduling/control workflow found. | Missing integration |
| M07 | Cache warmth/idle feedback | Afreet shows idle/cache state. Howcode provides historical usage/cache statistics, not the same predictive warmth indicator. | Partial |
| M08 | Token, context and cost inspection | Howcode's composer inspector shows input/output/cache/cost and context statistics. It is not missing. | Present |
| M09 | Account quota balance | Context used and estimated token cost are not subscription allowance. No complete account-quota balance workflow was established in either app. | Neither established |
| M10 | Cached WebSocket and continuation | Already supported by the installed Pi provider, including missing-continuation recovery and sticky SSE fallback. Afreet also owns these mechanisms. | Present, different implementation |
| M11 | Automatic/manual compaction | Howcode uses Durable's text-summary compaction. Afreet supports opaque Responses Lite V2 checkpoints, or notes-first rollover when selected. | Present, different semantics |
| M12 | Native V2 compaction/prewarm lineage | Not composed in Howcode. Sibling OpenAI Responses code has reusable primitives, but Howcode currently constructs `builtinModels`, not that provider. | Integration, substantial |
| M13 | Retry and interrupted-stream recovery | Both have recovery machinery. Pi and Afreet differ in retry count, stream-start behaviour and lane reset. No fault-injection exercise here, so no claim that one is universally more reliable. | Present, unproven equivalence |
| M14 | Server-owned durable work | Browser closure does not define task lifetime. Howcode opens SQLite Harness state and resumes native work. Actual restart semantics still depend on each extension's side effects. | Present |

Do not replace Pi Durable to obtain a settings checkbox. Keep provider-specific request/continuation policy in a provider integration, and per-conversation choices in supported runtime contracts. Numeric tiers should not claim capacity a selected model does not support.

Evidence:

- `H/desktop/settings/models.ts:11`, `H/desktop/settings/provider-auth.ts:16`, `:65`, `H/desktop/settings/provider-config.ts:44`, `H/desktop/durable-runtime/host.ts:70`, `:86`.
- `HC/packages/composer/src/composer-context-meter.tsx:328`, `HC/packages/composer/src/composer-model-popover.tsx:203`, `H/src/app/settings/settings/settingsDescriptorRuntime.tsx:110`.
- `A/src/web/composer-model-settings.tsx:60`, `A/src/provider/responses-lite/request.ts:23`, `:134`, `A/src/provider/responses-lite/session-context.ts:50`, `A/src/provider/responses-lite/session-keepalive.ts`.
- Installed `H/node_modules/@earendil-works/pi-ai/dist/api/openai-codex-responses.js:145`, `:650`, `:1159`; installed `H/node_modules/@earendil-works/pi-durable/dist/harness/compaction.js:55`.
- `D/packages/openai-responses/src/index.ts:81`, `D/packages/openai-responses/src/prewarm.ts:46`, `D/packages/context/README.md`.

## Voice, files and user-facing surfaces

| ID | Capability | Howcode against Afreet | Status |
| --- | --- | --- | --- |
| U01 | Dictation into the draft | Implemented local speech-to-text, but the current settings request visibly fails. LAN HTTP separately blocks microphone capture. | Present implementation, broken observed setup |
| U02 | Realtime spoken conversation | Afreet has a hold-to-talk/start-call workflow, spoken responses and session controls. Howcode dictation is not conversational voice. | Integration, large |
| U03 | Voice delegates to chat agents | Afreet routes spoken work into ordinary chat signals, keeping speech distinct from consequential execution. No composed Howcode counterpart. | Missing integration |
| U04 | Cross-chat voice transfer | Afreet reserves/prepares a target, coordinates focus acknowledgement and finishes departure speech. Voice packages have reusable mechanics, but Howcode has no connected workflow. | Missing integration |
| U05 | Voice selection and session settings | Afreet exposes workspace voice selection. Durable GipPity/Grok settings are reusable, but neither is an active Howcode voice feature. | Integration |
| U06 | Upload, paste/drop and image input | Both have these. Howcode also supports host file references and file mentions. | Present |
| U07 | Durable original-attachment retention | Afreet stores chat-owned originals. Howcode uploads are temporary and subject to 14-day cleanup. Cleanup is accepted if the conversation remains continuable. | Accepted difference |
| U08 | Attachment limits | Afreet: 10 files, 10 MiB each, 20 MiB total. Howcode browser upload: 20 files, 50 MiB each, 100 MiB total; model image input separately caps 20 MiB. Upload acceptance does not guarantee model-input acceptance. | Different |
| U09 | General workspace file editor | Afreet Files has revisions/conflict-aware writes. Howcode provides attachments and specialised artifacts, not a general editor. Its stated product scope rejects becoming a general code editor. | Deliberate exclusion candidate |
| U10 | Markdown/React artifacts | Installed Howcode components provide these surfaces. Their presence does not substitute for generic forms/approvals. | Present |
| U11 | Saved-output catalogue and collections | Howcode Spaces discovers producer-owned outputs/revisions and supports collection organisation, open, prune and delete. Not a layout preset or workspace directory. | Howcode extra |
| U12 | Human interactive terminal | Both have chat-bound terminal sessions separate from agent shell tools. Howcode persists transcript logs. Multiple terminals per identical chat/cwd are not an established Afreet advantage. | Present |
| U13 | Agent control of the human terminal | Shell execution tools are separate from browser PTY ownership. No Afreet parity justification for adding a general terminal-control tool was established. | Not a demonstrated gap |
| U14 | Named layout library | Afreet has named global placement presets with per-chat selection, rename and guarded deletion/reset. Howcode has no named preset catalogue. | Missing convenience |
| U15 | Flexible docking and workspace defaults | Howcode saves per-chat geometry, panels, groups, splits, floating positions and a workspace default. This is richer geometry than Afreet contribution placement. | Present, Howcode extra |
| U16 | Preset cloning/global layout default | Afreet has no one-click clone and no separate workspace-owned default-layout field. Its Default preset seeds chats. Do not invent these as requirements copied from Afreet. | Neither equivalent |
| U17 | Themes and configurable shortcuts | Howcode has both, including shortcut recording/conflict handling. No comparable Afreet editor found. | Howcode extra |
| U18 | Bundled end-user help | Afreet ships 21 help pages covering use and authoring, with UI and agent access. Howcode has About/Roadmap/Changelog and inline descriptions, not equivalent help. | Partial |
| U19 | Slash commands | Howcode has `/settings`, `/new`, `/compact`, `/fork` and skill paths. Afreet additionally has `/name`, `/model`, `/reasoning`, `/extensions`; AutoTrees `/prime` and `/end` manage context, not Git worktrees. | Present, different catalogue |
| U20 | First-run resident onboarding | Afreet sets up its operator and placeholder bot identity. Howcode has setup controls but no equivalent guided resident introduction. | Partial |
| U21 | Narrow-screen usability | A 390×844 inspection found compressed/crowded controls in both apps. Howcode's empty resident view/composer and Afreet's context/footer need further practical phone validation. No accessibility or mobile-completeness verdict from CSS alone. | Not accepted as complete |

Evidence:

- `HC/packages/dictation/src/service-contribution.ts:63`, `HC/packages/dictation/src/context.tsx:13`, `HC/packages/dictation/src/ui/composer-dictation-controls.tsx:159`; live Settings error recorded above.
- `A/src/web/composer-voice-button.tsx:11`, `A/src/web/use-chat-commands.ts:121`, `A/src/voice/connections.ts:118`, `A/src/server/chat-focus.ts:146`, `A/src/web/realtime-voice-transfer.ts:21`.
- `D/packages/gippity-voice/src/controller.ts:80`, `D/packages/grok-voice/README.md`. These require host audio/session/instruction/settings contracts, not just package installation.
- `H/src/desktop-host/browser-upload-attachments.ts:25`, `:118`, `:175`, `H/src/server/server.ts:109`, `H/desktop/durable-runtime/input.ts:20`, `:48`; `A/src/attachments/contract.ts:5`, `A/src/attachments/storage.ts:224`.
- `A/src/extensions/bundled/files/file.tsx:7`, `HC/packages/spaces/src/renderer.tsx:52`, `HC/packages/spaces/src/service.ts:14`.
- `A/src/terminal/service.ts:51`, `HC/packages/terminal/src/service/session-id.ts:4`, `HC/packages/terminal/src/service/manager.ts:91`, `HC/packages/terminal/src/service/session-history.ts:79`.
- `A/src/layouts/layout-json.ts:95`, `:199`, `A/src/web/layout-settings.tsx:22`, `A/src/web/workspace-settings-dialog.tsx:106`, `A/src/chats/contract.ts:106`.
- `HC/packages/sdk/src/workspace-layout-state.ts:109`, `H/desktop/chat-repository/workspace-layout.ts:25`, `H/desktop/durable-runtime/workspace-layout-tool.ts:15`.
- `HC/packages/sdk/src/composer-slash-commands.ts:19`, `A/src/web/composer-commands.tsx:43`, `A/src/extensions/bundled/auto-trees/server.ts:4`, `A/src/extensions/bundled/help/pages/`.

## Deployment, access and distribution

| ID | Capability | Howcode against Afreet | Status |
| --- | --- | --- | --- |
| O01 | Server/browser separation | Both keep execution and durable state on the server. Howcode uses stock Node; Afreet uses Bun. | Present, different runtime |
| O02 | Secure origin for remote microphone | Afreet auto-enables its own TLS for non-loopback listeners. Howcode serves HTTP and relies on loopback or an external HTTPS proxy. The current LAN address cannot record. | Missing built-in setup |
| O03 | Trusted-device access | Howcode has an access-token/session-cookie/browser-bridge model. Neither product establishes per-human accounts, ACLs or safe hostile multi-tenancy. People is attribution, not authentication. | Different, not an ACL gap |
| O04 | External resource/control API | Afreet has a separate bearer-authenticated listener, documented resources and token rotation. Howcode's private browser bridge/package CLI is not that public control surface. | Missing |
| O05 | API token viewing/rotation/reference UI | Afreet implements it. Howcode accepts a launch token but lacks an equivalent live API-access workflow. | Missing |
| O06 | Live package admission and diagnostics | Howcode supports live generations and visible loading failures. A Ready status only establishes registration, as the dictation failure demonstrates. | Present, acceptance gap |
| O07 | Current profile vs fresh install | Bots/Agents/Pulses/Notebook are active here but not all seeded on a new install. Decide the intended distribution explicitly instead of baking domains into core. | Delivery gap |
| O08 | Reproducible release dependencies | Current shell references sibling content-hashed tarballs. Repository policy explicitly calls these development dependencies, not distributable release references. | Delivery gap |
| O09 | Restart/closed-browser practical acceptance | Source supports durable recovery, but this audit did not restart services or interrupt paid/side-effecting tasks. | Not exercised |

Evidence: `H/src/server/options.ts:50`, `:78`, `H/src/server/auth.ts:35`, `H/src/server/request-router.ts:64`; `A/src/server/listen-config.ts:9`, `A/src/server/tls.ts:36`, `A/src/server/control-http.ts:30`, `A/src/control/auth.ts:22`; `H/components/packages/service/default-packages.generated.ts:2`, `H/package.json`, `H/AGENTS.md`.

## What to do today

Work in vertical slices. A package being installed, or a button rendering, is not a completed slice.

| Order | Work | Smallest durable owner | Size and dependency |
| --- | --- | --- | --- |
| 0 | Repair observed dictation setup; decide a usable HTTPS access route | Dictation component/package binding; server deployment | Bounded diagnosis. Do not claim a stale-package cause without tracing it |
| 1 | Bring in patch/image inspection/web/imagegen capabilities through supported adapters | Durable packages plus narrow Howcode capability composition | Patch is small. Other factories need explicit host capabilities/auth, practical calls and output presentation |
| 2 | Choose and connect Context notes/history/rollover | Durable Context adapter with Harness/storage/admission lifecycle | Medium. Requires handling all input origins, including workers/pulses, rather than only composer sends |
| 3 | Finish resident memory and friendly peer discovery | Bots component; public directory contract consumed by Agents | Medium-to-large. Keep workspace file memory distinct from virtual Context notes |
| 4 | Add the everyday attention gaps | Navigation/chat lifecycle owners, renderer/composer | Separate slices: global content search; done/reminders; Simple view; existing-chat promotion |
| 5 | Close pulse workflow gaps | Pulses component and portable scheduler contracts | Run summary/history and enable controls first; explicit decision on parent wake and fresh-run policy |
| 6 | Add structured human questions and resource snapshots | Dedicated UI capability plus Composer/public SDK contracts | Medium. Persist response and cancellation semantics, not only form markup |
| 7 | Integrate realtime voice and transfers | Dedicated Howcode voice component consuming existing engines | Large. Audio ownership, secure origin, focus/handoff, tool delegation and shutdown must agree |
| 8 | Add webhook-triggered work | Receiver component plus Pulses durable admission | Large. Receiver setup, auth/deduplication, bounded queue, quiet hours, restart and payload trust |
| 9 | Add provider-native response controls where justified | Provider integration plus conversation settings | Fast/presets are smaller. V2 context/prewarm/paid keepalive are a separate substantial slice |
| 10 | Finish optional parity and packaging | Owning components and release composition | Named layouts, avatar assets, Help, operator onboarding, workspace archive/move, fresh-profile delivery |

Recommended first acceptance target: a known resident can receive a task, use the expected tools, remember the result in an inspectable owner, delegate to another named resident, and leave a findable result when the browser is closed. That exercises the product rather than collecting isolated toggles.

Do not spend today's budget cloning Afreet's internal runtime, fixed provider catalogue, source-folder packaging or exact schema names. Keep Howcode's multi-provider support, native Durable ownership, optional components, Inbox, docking, forks and Git workflows. General file editing is a separate product decision. Push notifications and a universal responsibility ledger are not prerequisites for matching features Afreet actually implements.

## Verification and limits

- Read current implementation paths in all four repositories, including actual installed Durable and Agents dependencies where versions matter.
- Used the supported package-list command and inspected live Howcode General, Chat and Components settings, resident composer, provider controls and dictation settings.
- Inspected live Afreet navigation, resident/attention controls, response settings, general settings and webhook setup. No account, token, webhook, model or schedule setting was changed.
- Inspected both apps at desktop size and a 390×844 viewport. This is a narrow-screen sample, not full phone or accessibility acceptance.
- Did not send model work, trigger pulses/webhooks, start voice, delete assets, restart services or inject failures. Source-backed features are not labelled live-verified workflows just because their controls exist.
- Existing People implementation had prior practical validation. It was included, not repeated or modified.
- No implementation changes, tests, builds or commits were made for this investigation. Existing uncommitted work was preserved.

Before declaring any implemented slice complete, exercise its success path and its actual boundary: interrupted call, stale selection, disabled component, closed tab, retained file, duplicate event or missing provider, as appropriate. The report identifies where those boundaries are; it does not pretend they were all proved today.
