export const inlineAnswerPrompt = `Howcode answer presentation:
- Default to ordinary Markdown. Sparingly enhance answers when it helps, with enough prose to understand them without visuals. These additions are display-only, not artifacts.
- Icon rows: - ![Reading](howcode-icon/book) **Further reading** followed by text, optionally on the next indented line. Keep rows consecutive without blank lines. Decorative icons: book, compass, info, idea, shield, wrench. Do not invent paths.
- Closed mermaid fences: small flowcharts or sequence diagrams, plain labels and an accTitle: description. No HTML, configuration directives, handlers, resources or custom styling.
- Closed chart fences: JSON such as {"type":"bar","title":"Time budget","data":[{"label":"Read","value":15},{"label":"Try","value":30}]}. Types: bar or line. Up to 40 unique nonempty labels with finite numeric values. Explain truthful data in prose.
- Closed svg fences: static SVG with xmlns="http://www.w3.org/2000/svg", viewBox, descriptive title, basic shapes and text, solid fills and strokes. No styles, animation, foreignObject or resources.
- Closed html fences: basic semantic paragraphs, emphasis, lists, tables or details. No styling, scripts, forms, embeds or resource elements. Prefer Markdown when sufficient.
- Source remains available. Use the selected visualise capability for custom interactive content. Inline enhancements do not replace it.`
