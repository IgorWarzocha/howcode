---
version: alpha
name: howcode
description: Quiet, native-feeling desktop workbench for agentic coding and more, centered on a composer-first interaction model.
colors:
  primary: "#B9BFF3"
  primary-strong: "#D5DAED"
  background: "#1D1F2A"
  workspace: "#1F2230"
  sidebar: "#262936"
  panel: "#2A2D3B"
  panel-raised: "#2D3140"
  panel-highlight: "#343848"
  terminal: "#171923"
  text: "#D5DAED"
  text-muted: "#969DB7"
  text-subtle: "#727894"
  success: "#86D9A0"
  danger: "#F2A7A7"
  link: "#81A2BE"
typography:
  view-title:
    fontFamily: Inter Variable
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  section-title:
    fontFamily: Inter Variable
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontFamily: Inter Variable
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-readable:
    fontFamily: Inter Variable
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.68
  control:
    fontFamily: Inter Variable
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.25
  metadata:
    fontFamily: Inter Variable
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
  metadata-caps:
    fontFamily: Inter Variable
    fontSize: 10px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.12em
  code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.55
spacing:
  none: 0px
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  viewport-x: 20px
  sidebar-x: 10px
  composer-x: 16px
  composer-y: 12px
rounded:
  none: 0px
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  xxl: 28px
  full: 9999px
components:
  app-shell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.text-muted}"
    typography: "{typography.body}"
    padding: "{spacing.md}"
  nav-item:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.text-muted}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: 32px
    padding: "{spacing.sm}"
  nav-item-active:
    backgroundColor: "{colors.panel-highlight}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
  composer-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  composer-input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    typography: "{typography.control}"
    rounded: "{rounded.full}"
    height: 32px
    padding: "{spacing.lg}"
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.background}"
    typography: "{typography.control}"
    rounded: "{rounded.full}"
  button-quiet:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text-muted}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: 28px
    padding: "{spacing.sm}"
  button-danger:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.danger}"
    typography: "{typography.control}"
    rounded: "{rounded.full}"
    height: 28px
    padding: "{spacing.sm}"
  toolbar-chip:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text-muted}"
    typography: "{typography.metadata}"
    rounded: "{rounded.full}"
    height: 28px
    padding: "{spacing.md}"
  metadata-subtle:
    textColor: "{colors.text-subtle}"
    typography: "{typography.metadata}"
  status-success:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.success}"
    typography: "{typography.metadata}"
    rounded: "{rounded.full}"
  link:
    backgroundColor: "{colors.workspace}"
    textColor: "{colors.link}"
    typography: "{typography.body}"
  popout:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.sm}"
  thread-message:
    backgroundColor: "{colors.workspace}"
    textColor: "{colors.text}"
    typography: "{typography.body-readable}"
    rounded: "{rounded.lg}"
  diff-panel:
    backgroundColor: "{colors.workspace}"
    textColor: "{colors.text}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
  terminal-panel:
    backgroundColor: "{colors.terminal}"
    textColor: "{colors.text}"
    typography: "{typography.code}"
    rounded: "{rounded.xl}"
  empty-state:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
---

# howcode Design System

## Overview

howcode is a quiet, native-feeling desktop workbench for agentic **coding and more**: minimal and understated on the surface, but feature-packed where it matters. Its UI should speak for itself through familiar chat patterns, transferable desktop UX, clear hierarchy, and domain-specific controls that behave exactly as users expect. The composer is the app's cockpit — the primary place to ask, attach context, control agent behavior, review work, and continue forward — while secondary power lives in obvious grouped surfaces like Git, terminal, project, and model controls. The design should feel immediately usable to people coming from editors, terminals, and chat apps, while also approachable for less technical users who want to get work done without first learning developer rituals. howcode should be opinionated in its UX: frequent actions are first-class, related actions are grouped, advanced actions are discoverable, and nothing important depends on mystery, decoration, or hidden gestures.

The product personality is **quiet, native, focused, opinionated, and feature-packed**. It should not feel like a marketing SaaS dashboard, a novelty AI toy, or a cyberpunk developer skin. It should feel like a serious local desktop tool that reveals power through good grouping and precise affordances.

The core design rule is: **every visible control must earn its place by frequency, proximity, or domain clarity.** If it is frequent, surface it. If it is related, group it. If it is powerful, make the entry point obvious. If it is rare, keep it quiet but findable.

## Colors

howcode is dark-only for now. The palette is low-glare and blue-tinted, with a soft periwinkle accent used sparingly for primary actions, selection, and active state emphasis.

- **Primary (`#B9BFF3`):** The interaction accent. Use it for send/confirm actions, selected controls, high-signal running/active affordances, and rare emphasis. Do not use it as a large background wash.
- **Background / workspace (`#1D1F2A`, `#1F2230`):** The app should sit on quiet dark blue-gray foundations. The workspace should recede behind content and the composer.
- **Sidebar / panel layers (`#262936`, `#2A2D3B`, `#2D3140`, `#343848`):** Use tonal layering rather than strong outlines or heavy shadows. Raised panels are only slightly lighter than their parent surface.
- **Text (`#D5DAED`, `#969DB7`, `#727894`):** Main text is soft, never pure white. Muted text carries metadata, labels, timestamps, secondary descriptions, and inactive controls.
- **Success / danger (`#86D9A0`, `#F2A7A7`):** Reserved for real status, not decoration. Danger should be calm but unmistakable.
- **Links (`#81A2BE`):** Links should read as links without becoming the dominant accent system.

Avoid broad gradients, glow effects, neon palettes, and pure black/white. The UI should earn contrast through hierarchy, state, and containment rather than spectacle.

## Typography

Use **Inter Variable** as the product font. It is familiar, compact, and appropriate for a native-feeling desktop app. Use it deliberately: modest headings, readable body text, compact controls, and tight metadata.

- **View titles:** 18px medium. Clear but not page-hero sized.
- **Section titles:** 15px medium. Used for grouped panels, settings sections, and utility views.
- **Body:** 14px regular at 1.5 line-height for app UI.
- **Readable markdown/chat:** 15px regular with looser line-height for assistant/user prose.
- **Controls:** 13px medium. Labels should feel precise, not loud.
- **Metadata:** 12px regular; use 10px uppercase only for short status labels, never paragraphs.
- **Code/terminal:** Use JetBrains Mono or the platform monospace fallback only for code, terminal output, paths, commands, and tabular technical data.

Do not create large decorative type moments inside workflow surfaces. The app is a tool; typography should clarify hierarchy and scanning, not perform brand theater.

## Layout

The layout is desktop-first and compact. The app is allowed to be dense because it is a workbench, but it must never become ambiguous. Use a 4px-based rhythm with common steps of 4, 8, 12, 16, 24, and 32px.

The primary layout model is:

- **Sidebar:** persistent project/thread/navigation context. It should be compact and scannable.
- **Workspace:** the central content and thread area. It should be visually quiet and leave room for reading output.
- **Composer:** anchored, first-class, and always treated as the main control surface when active.
- **Drawers/popouts:** domain-specific expansions for grouped power, such as Git operations, terminal, model selection, file picking, and project actions.

High-frequency actions should live directly on or near the surface they affect. Low-frequency actions should be grouped behind a clearly scoped control. Avoid generic placement that forces users to remember where unrelated actions live.

Content max-widths should protect readability. Chat/prose should stay narrower than the full workspace, while diff and terminal surfaces may use the available width when needed.

## Elevation & Depth

Depth is mostly tonal. Use slightly different surface colors, subtle borders, and occasional soft shadows to communicate containment. Heavy shadows, glass blur, and floating-card stacks should be rare.

Primary surfaces should feel stable rather than floating. The composer may have stronger containment because it is the cockpit, but it should still feel docked to the workbench rather than like a modal overlay.

Use borders and inset shadows carefully for state and grouping. Avoid decorative side stripes and other admin-dashboard clichés. If an element needs attention, prefer better placement, clearer label, tonal contrast, or a state-specific icon.

## Shapes

The shape language is rounded but compact: soft enough to feel native and approachable, not so soft that it becomes toy-like.

- Use 10px radius for compact controls and sidebar rows.
- Use 14px radius for medium panels and popouts.
- Use 20px radius for major docked surfaces like the composer.
- Use full radius for pills, chips, and circular icon buttons.

Nested radii should be concentric: outer radius should be larger than inner radius by roughly the padding amount. Do not use the same large radius on every nested surface.

## Components

**Composer** is the primary brand component. It is not just a textarea. It is the place where users ask, attach context, choose agent behavior, stop or continue work, open terminal help, enter Git operations, and recover from errors. It should be compact, visibly anchored, and stateful. Empty, draft, sending, streaming, stopped, queued, dictating, attached, and error states should each be legible.

**Composer controls** should stay close to the input and the thing they affect. Attachments belong near the prompt. Model/thinking belongs in the agent/model control. Git belongs behind a Git entry point. Terminal belongs behind a terminal entry point. The user should be able to see an icon, infer the domain, click it, and get the expected grouped capability.

**Sidebar rows** are navigation and context, not decoration. They should be compact, stable, and clear about active/running/unread/selected states. Project actions should be discoverable without cluttering every row at all times.

**Popouts and menus** should feel like scoped tool trays. A Git popout should contain Git things. A model popout should contain model/thinking things. A project popout should contain project things. Avoid dumping unrelated actions into generic overflow menus.

**Diff and Git surfaces** should support review and control without forcing terminal use for common workflows. Terminal remains available for advanced or unusual operations, but common Git operations should be approachable through familiar UI.

**Terminal** should feel native and powerful, but not like the only legitimate path. It is an escape hatch and power surface, not a punishment for missing UI.

**Buttons** should be quiet by default. Use the primary accent for the single most important action in a local context, such as sending or confirming. Secondary and toolbar actions should use muted text and tonal backgrounds.

**Empty states** should teach or route. They should not apologize and should not become large marketing panels. Tell the user what they can do next.

**Icons** should be literal and familiar. Lucide-style line icons are appropriate. If the icon cannot carry the domain clearly, pair it with text or place it in a more obvious group.

## Do's and Don'ts

- Do make high-frequency actions first-class.
- Do group lower-frequency actions behind obvious domain controls.
- Do make every icon-backed action match user expectation.
- Do treat the composer as the app's cockpit.
- Do keep attachments, model controls, terminal, Git, and diff review feeling like extensions of the composer workflow.
- Do make active, selected, running, queued, dirty, streaming, and error states visually distinct.
- Do use progressive disclosure by domain, not by arbitrary complexity.
- Do make keyboard focus visible.
- Do preserve keyboard parity for core workflows.
- Do use compact controls with hit areas large enough to operate comfortably.
- Do use precise microcopy where labels appear.
- Do make empty states teach the next action.
- Don't make everything first-class.
- Don't bury everyday actions in menus.
- Don't scatter related actions across unrelated surfaces.
- Don't use generic overflow menus as a dumping ground.
- Don't make users understand internal session/project/runtime mechanics before acting.
- Don't let the composer become just a textarea.
- Don't overload the composer with unlabeled mystery icons.
- Don't rely on hover-only discovery for important actions.
- Don't rely on double-click as the only path for meaningful actions.
- Don't make an icon open something surprising.
- Don't use neon, glow, cyberpunk, glassy SaaS, purple-blue gradients, gradient text, or decorative sparkles as a personality substitute.
- Don't over-card the layout.
- Don't add large marketing-style empty states inside workflow surfaces.
- Don't make buttons oversized or mobile-ish just to improve clarity; improve structure and affordance first.
- Don't use vague labels like "Options," "Tools," or "Advanced" when a domain label exists.
