# Native interactive artifacts guidance

- Owns iframe-backed artifact previews for HTML and React artifacts.
- HTML and React share one interactive runtime path; do not split React-only behavior unless it gets a separate product surface.
- Keep markdown editing/preview in `@howcode/native-markdown-artifacts`.
