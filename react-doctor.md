# React Doctor

React Doctor 0.7.8 reports **100/100** with no diagnostics.

```text
Errors:   0
Warnings: 0
Score:    100
```

The scan covers the app, Electron and desktop services, shared contracts, scripts, the Pages site, launcher, and polls worker. Generated `dist-pages` output and local reference checkouts under `Frameworks` are excluded in `doctor.config.ts`.

## UX checks

These paths changed enough to deserve a human pass. The automated suite protects contracts and state transitions, not feel.

- **Composer menus:** model, context, Git baseline, attachment picker, dictation prompt, and session-tree popovers still open from the same anchors and close on outside click or Escape. Nested Escape should close only the top layer.
- **Composer scope changes:** switch projects and threads with a draft, attachments, an open picker, or a running extension command. Each scope should restore only its own draft and transient state.
- **Dictation:** start, stop, cancel, install a missing model, and switch composer scope while transcription is pending. The prompt must not reappear after its model becomes available.
- **Artifact drawer:** open, close, toggle fullscreen, switch conversations, and repeat in compact-sidebar mode. Focus should enter the overlay and return to its previous control when the drawer closes.
- **Session tree and thread find:** preview an entry, close the tree, navigate with and without a summary, search beyond the loaded message window, and clear the search. Row expansion and smooth scrolling should land on the requested message.
- **Sidebar project work:** change the visible-project scope, remove a project from that scope, rename a project, edit its worktree directory, and run bulk archive actions. Compact and expanded sidebar layouts should remain in step.
- **GitOps:** open and search the baseline selector, close and reopen it, change baseline, edit a commit message, commit, and then dirty a clean tree. Search and clean-state messages should reset without a one-frame stale value.
- **Settings:** edit project location, custom Pi directory, dictation model, and a searchable select. External settings updates should replace stale drafts; closing and reopening a select should clear its search.
- **Terminal:** open a shell and a Pi session, resize into and out of compact mode, focus the composer, and return from takeover. The terminal must keep the session path captured at launch.
- **Pages site:** check the GitHub mark at normal and high-DPI scale. Its path coordinates were rounded to remove needless SVG precision.

## Load-bearing scan policy

`doctor.config.ts` keeps project-wide exceptions in one visible place:

- Native/runtime packages are retained even without static imports because Electron packaging and runtime `require()` calls need their complete dependency trees outside ASAR.
- Component line-count, local-component-count, and boolean-prop thresholds are not gates here; Biome's enforced complexity limit is. The rule defaults produced counts, not defects.
- A few committed effects intentionally publish async data or imperative close handlers to their owner after commit. Moving those writes into render would expose work React may discard.
- Attachment roots are chosen by the trusted desktop picker, canonicalized, and descendants are constrained to that root. Updater assets are restricted to the configured release origin and verified by SHA-256 before installation. React Doctor cannot follow either trust check through the full flow.

Do not replace these with inline disables. If an exception stops matching the architecture, remove it from `doctor.config.ts` and fix the newly visible diagnostics.
