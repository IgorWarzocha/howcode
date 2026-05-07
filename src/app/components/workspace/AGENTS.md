# Workspace layout guidance

- Composer/footer responsiveness belongs in `WorkspaceComposerDock`; do not patch fold/sidebar spacing separately in code/chat views or inside `ComposerPromptSurface`.
- The fold button and paperclip must share the dock/composer coordinate system: sidebar glue on wide layouts, smooth slide toward composer only when lhs whitespace collapses.
