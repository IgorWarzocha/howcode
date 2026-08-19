# Settings descriptions

Edit the `Description` text. Keep each `ID` unchanged so edits can be mapped back.

## src/app/views/settings/settingsDescriptorProjects.tsx

### Default project location

- ID: `projects.default-location`
- Category: `projects`
- Description:

Default folder for new projects.

### Initialise git

- ID: `projects.initialize-git`
- Category: `projects`
- Description:

Always git init when creating a new project.

### GitOps default

- ID: `projects.gitops-default`
- Category: `projects`
- Description:

Default global commit action.

### Diff comparison default

- ID: `projects.git-diff-baseline-default`
- Category: `projects`
- Description:

Default baseline setting for git summary.

### Diff view default

- ID: `projects.git-diff-render-default`
- Category: `projects`
- Description:

Default layout for the GitOps diff panel.

### Diff file tree

- ID: `projects.git-diff-file-tree-default`
- Category: `projects`
- Description:

Default visibility for the GitOps file tree.

### Project deletion cleanup

- ID: `projects.deletion-mode`
- Category: `projects`
- Description:

Delete only Pi session files, or nuke the full project folder.

### Project UI import

- ID: `projects.import-ui`
- Category: `projects`
- Description:

Scan projects for UI info like repo and origin status.

### Favorite folders

- ID: `projects.favorite-folders`
- Category: `projects`
- Description:

Paths shown in the attachment picker alongside Home.

### Clipboard images

- ID: `projects.clipboard-images`
- Category: `projects`
- Description:

Delete temp clipboard images.

## src/app/views/settings/settingsDescriptorCommon.tsx

### Send while Pi is responding

- ID: `common.streaming-behavior`
- Category: `pi-runtime`
- Description:

Composer follow-up messages behavior.

### Open in TUI

- ID: `common.pi-tui-takeover`
- Category: `pi-runtime`
- Description:

Always use Pi TUI takeover.

### Hover to type

- ID: `common.hover-to-focus`
- Category: `pi-runtime`
- Description:

Hover to input for composer and terminal.

### Stop typing on hover leave

- ID: `common.hover-to-blur`
- Category: `pi-runtime`
- Description:

Instantly leave input when not in hover area.

## src/app/views/settings/settingsDescriptorModels.tsx

### Chat

- ID: `models.chat`
- Category: `models`
- Description:

Default settings for the Chat view.

### Code

- ID: `models.code`
- Category: `models`
- Description:

Default settings for the Code view.

### Git commit messages

- ID: `models.git-commit`
- Category: `models`
- Description:

Default settings for the GitOps view.

## src/app/views/settings/settingsDescriptorPiRuntime.tsx

### Theme

- ID: `pi-runtime.theme`
- Category: `pi-runtime`
- Description:

Select a theme to use. Syncs with Pi's JSON files.

### Transport

- ID: `pi-runtime.transport`
- Category: `pi-runtime`
- Description:

Soon to be deprecated.

### Auto compact context

- ID: `pi-runtime.auto-compact`
- Category: `pi-runtime`
- Description:

Switch auto compaction on or off.

### Enable skill slash commands

- ID: `pi-runtime.skill-commands`
- Category: `pi-runtime`
- Description:

Expose installed skills as /commands.

## src/app/views/settings/settingsDescriptorDictation.tsx

### Speech-to-text model

- ID: `dictation.models`
- Category: `dictation`
- Description:

Dictation model selection.

### Max dictation length

- ID: `dictation.max-duration`
- Category: `dictation`
- Description:

`Safety net in case you forget. Default is ${DEFAULT_DICTATION_MAX_DURATION_SECONDS / 60} minutes.`

### Toggle dictation

- ID: `dictation.show-button`
- Category: `dictation`
- Description:

Hide if you have a preferred dictation system.
