# App typography cleanup report

This is a standalone report for a future typography cleanup PR.

The problem is app-wide. Skills is only a loud example because it currently mixes several font owners in one small view. Do not treat Skills as the first or only target. Treat it as proof that the current typography system is too loose.

## Short version

We have too many ways to set text size.

A future pass should give the app a small, named typography scale and then move shared components onto it. After that, individual views should mostly say things like:

- this is a view title
- this is a section heading
- this is row text
- this is muted row detail
- this is control text
- this is metadata
- this is tiny chrome

They should not keep inventing `text-[12px]`, `text-[12.5px]`, `text-[13px]`, etc. per component.

## Current state

Typography is controlled from several places at once:

| Layer | Examples | Problem |
| --- | --- | --- |
| Global CSS | `src/styles/base.css` | Sets app body default, but most UI overrides it. |
| Shared class strings | `src/app/ui/classes.ts` | Useful, but many classes hardcode their own one-off sizes. |
| Plain CSS component rules | `src/styles/settings.css`, `src/styles/primitives.css`, `src/styles/sidebar.css` | These can override Tailwind utilities and hide where the real size comes from. |
| Common components | `TextButton`, `DisclosureSection`, `ViewHeader`, `CompactMetaRow` | Some bring their own font size, so callers fight them. |
| Feature/view files | settings, composer, thread, diff, extensions, skills, inbox, project overview | Lots of local `text-[...]` and `leading-[...]` values. |
| Feature-local mini systems | currently `src/app/features/skills/skills-ui.ts` | Wrong direction if it becomes a separate font scale. |

## Evidence from the current app

### Global baseline

`src/styles/base.css`:

- body is `14px / 1.5`
- textareas inherit font family and get their own line-height

This is fine as a base, but most real UI does not rely on it.

### Shared UI classes

`src/app/ui/classes.ts` already has some named roles:

- `viewTitleClass` → `18px`
- `viewSubtitleClass` → `13px`
- `sectionTitleClass` → `15px`
- `sectionDescriptionClass` → `13px`
- `disclosureButtonClass` → `13px medium`
- `ghostButtonClass` → `12.5px`
- `toolbarButtonClass` → `12.5px`
- `primaryButtonClass` → `13px`
- `inlineEmptyNoteClass` → `12px`
- composer popover classes → `10.5px`, `11.5px`, `12.5px`

This is close to being a system, but it is not explicit enough. The size is buried inside chrome classes instead of being reusable typography primitives.

### CSS-backed rules

`src/styles/settings.css`:

```css
.settings-control-text {
  font-size: 12px;
  line-height: 16px;
}
```

This means controls using `settings-control-text` are not really controlled by local Tailwind text classes. The CSS rule is the owner.

`src/styles/primitives.css` also owns app text in places:

- `.composer-footer-text` → `12px`
- tooltip-ish text → `11.5px`
- artifact version controls → `13px`
- other component-specific rules

`src/styles/sidebar.css` owns sidebar sizes separately:

- many `10px`, `11px`, `12px`, `12.5px`, `13px`, `13.5px`, `14px` rules

Some sidebar-specific tuning is fine, but it should still map to named app roles.

## Why local changes can appear to do nothing

### `TextButton` brings its own size

`src/app/components/common/text-button.tsx` always applies `ghostButtonClass`:

```tsx
className={cn(ghostButtonClass, className)}
```

`ghostButtonClass` includes:

```ts
text-[12.5px] leading-5
```

So any caller passing another text size is competing with the shared button class. Depending on CSS generation/cascade, the caller may not win. This makes local font-size tweaks unreliable.

### `.settings-control-text` is a CSS owner

Any class that includes `settings-control-text` inherits the CSS-backed `12px / 16px` rule.

Examples:

- settings inputs
- composer-ish text action controls
- newer quiet search/input classes

Changing nearby JSX text classes does not necessarily change the input text.

### `DisclosureSection` owns heading size

`src/app/components/common/disclosure-section.tsx` uses `disclosureButtonClass`.

That means headings like `Installed` / `Browse` are controlled by the shared disclosure primitive, not by the view using it.

That is good in principle. The problem is other headings are manually styled instead of using the same role.

## Bad example: Skills

Skills is a good bad example.

It currently has or recently had all of these in a small surface:

- page title from `ViewHeader` / `viewTitleClass`
- `Installed` and `Browse` from `DisclosureSection` / `disclosureButtonClass`
- `Create a skill` manually styled in the feature
- inputs from `quietSearchInputClass` / `settings-control-text`
- buttons from `TextButton` / `ghostButtonClass`
- rows from `CompactMetaRow` plus local row classes
- a feature-local `skills-ui.ts` with `text-[13px]` helpers
- tiny `.agents` action styled inline

The fix should not be “make a better Skills typography file.”

The fix should be app-wide typography primitives that Skills, Extensions, Settings, Composer, Thread, Diff, Sidebar, and project views can all use.

## Size sprawl

The renderer currently uses a lot of nearby sizes:

- `10px`
- `10.5px`
- `11px`
- `11.5px`
- `12px`
- `12.5px`
- `13px`
- `13.5px`
- `14px`
- `15px`
- `18px`
- plus special cases like `24px` and landing-page clamps

Some special cases are legitimate:

- marketing/landing hero text
- readable markdown/chat prose
- terminal/diff monospace
- sidebar labels if they really need density

But most app chrome should use fewer named roles.

## Proposed type roles

Add explicit typography primitives in `src/app/ui/classes.ts` and export them from `src/app/ui/index.ts`.

Names are flexible. The important thing is role-based usage.

```ts
appTypeViewTitleClass      // 18px, page/view title
appTypeSectionTitleClass   // 15px, section title
appTypeGroupTitleClass     // 13px medium, disclosure/group heading
appTypeBodyClass           // 14px, default app body
appTypeReadableClass       // 14/15px with looser line-height, chat/prose
appTypeControlClass        // 12.5px or 13px, buttons and compact controls
appTypeSmallClass          // 12px, helper/detail text
appTypeMetaClass           // 11px, metadata/counts/secondary chrome
appTypeTinyClass           // 10.5px, rare tiny labels
appTypeCodeClass           // mono 12px, code/log/terminal-adjacent UI
```

Also add tone helpers separately:

```ts
appToneTextClass
appToneMutedClass
appToneSubtleClass
appToneDangerClass
appToneAccentClass
```

Then usage becomes predictable:

```tsx
className={cn(appTypeGroupTitleClass, appToneTextClass)}
className={cn(appTypeSmallClass, appToneMutedClass)}
className={cn(appTypeControlClass, appToneMutedClass)}
```

That gives us the thing we actually want: “smaller and muted” means one known combination, not a new arbitrary size.

## What should be migrated first

Do not start with Skills specifically.

Start with the shared owners. Otherwise every view keeps fighting old defaults.

Suggested PR order:

### PR 1 — Add the shared type scale

- Add the app-wide type classes and tone classes in `src/app/ui/classes.ts`.
- Export them from `src/app/ui/index.ts`.
- Do not mass-edit the app yet.
- Maybe update docs/comments enough that future work knows these are the intended primitives.

### PR 2 — Move shared primitives onto the type scale

Convert the main shared classes first:

- `viewTitleClass`
- `viewSubtitleClass`
- `sectionTitleClass`
- `sectionDescriptionClass`
- `disclosureButtonClass`
- `ghostButtonClass`
- `toolbarButtonClass`
- `primaryButtonClass`
- `inlineEmptyNoteClass`
- `quietSearchInputClass`
- `composerPopover*` classes where sensible

The goal is not visual overhaul. The goal is: shared chrome uses named type roles.

### PR 3 — Fix CSS-backed typography owners

Decide what to do with these:

- `.settings-control-text`
- `.composer-footer-text`
- sidebar CSS font-size rules
- tooltip/font-size rules in `primitives.css`

Options:

1. replace them with utility classes where possible
2. make them use CSS variables matching the app type scale
3. keep them only for very specific surfaces, but document why

Do not leave them as mystery overrides.

### PR 4 — Pick one surface as proof

Pick a surface after the primitives are real. Good candidates:

- Settings, because it has lots of controls and rows
- Extensions, because it mirrors Skills and has catalog rows
- Skills, because it is currently a bad example and easy to judge

But this should be a proof of the app-wide system, not a feature-local cleanup.

### PR 5+ — Migrate by surface

Migrate one area at a time:

- settings
- extensions / skills
- project overview
- thread/tool-call leftovers
- composer popover leftovers
- diff/review panels
- sidebar only when we actually want to touch sidebar

## Rules for future work

- No new feature-local font scale unless there is a very specific reason.
- Avoid adding raw `text-[12px]` / `text-[13px]` in feature files.
- Prefer `appType* + appTone*` combinations.
- Shared components should expose typography variants or use shared type primitives internally.
- CSS classes that set font-size should map to the same type scale or be documented as special-case surfaces.
- Keep monospace/code/terminal text separate, but still named.

## Acceptance criteria for the cleanup

A future PR is probably successful if:

- changing a type primitive changes all intended consumers
- buttons do not secretly override caller font sizes
- inputs do not get mystery sizes from `settings-control-text`
- `DisclosureSection` headings and manually written group headings match by using the same role
- Skills does not need a Skills-only font-size system
- Extensions and Settings can reuse the same row/control/detail primitives
- grep shows fewer arbitrary `text-[...]` sizes in feature/view files

## Final take

The app already has the beginning of a design system, but typography is still encoded as one-off implementation detail.

We should make type roles first-class, then migrate surfaces onto those roles. That is the only way to stop redoing font fixes occurrence by occurrence.
