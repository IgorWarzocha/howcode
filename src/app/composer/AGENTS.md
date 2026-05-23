# Composer module guidance

- Composer owns prompt input, prompt surface, composer popovers, queued prompts, attachment picking, and submission glue.
- Keep Git-specific controls in `@howcode/native-gitops`; composer should expose extension points/props rather than importing GitOps internals when possible.
- Shared footer row/chip/text primitives live in `@howcode/workspace-shell/footer/workspace-footer-primitives`.
- Do not replace shared tooltip styling with native `title`; use `Tooltip`.
