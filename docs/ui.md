# Interface Design Conventions

Read this guide before changing React UI. Read [css](css.md) for styling and mobile behaviour and [i18n](i18n.md) for copy.

## Content

Name the current state or a concrete action. Do not add commentary that narrates design intent, explains obvious interface behaviour, or tells users how the page is meant to feel. Show hierarchy, defaults, consequences, and available actions through the interface itself.

Preserve established product terminology. Label actions by their user-visible outcome and keep equivalent actions worded consistently in both languages. Nutrition estimates are presented as estimates; never imply medical advice or diagnosis.

## Section hierarchy

Use headings and spacing to separate page sections. Do not add horizontal dividers between every section by default. Use borders when they materially clarify grouping within a dense surface.

## Action hierarchy

Place an action at the narrowest stable scope that owns its effect. A surface should normally have one clear primary action. Secondary and destructive actions must remain distinguishable without competing with it.

## Generic and domain boundaries

Generic components in `shared/ui` (for example `Dialog`, `LanguageSwitch`) accept generic data, copy, or callbacks. They must not import a feature module or expose props named after one feature's data.

Prepare feature-specific behaviour in the feature's `ui/` component or hook, then pass the generic component only what it needs.

## Forms

- Associate labels, descriptions, and errors with their control and expose invalid state through accessible attributes.
- Keep controlled number inputs as strings at the input boundary; `formatNumberInputValue` in `shared/ui/number-input.ts` shows an empty field for zero.
- Disable duplicate submission while a request is pending. The recognition input is locked while a recognition is running.
- Do not continuously mirror server data into local draft state with an effect; it can overwrite in-progress edits.

## Accessibility and feedback

- Give every control an accessible name; icon-only buttons need an `aria-label`. Toggle buttons expose `aria-pressed`.
- Show progress values as visible numbers, not only colour.
- Keep keyboard focus visible. Keyboard users must be able to complete the settings form and choose recommendations. Do not remove native semantics to simplify styling.
- Report a local validation or save failure beside the affected surface.
- Provide immediate pointer-down feedback for touch controls and preserve a disabled state that cannot activate.
- Respect `prefers-reduced-motion` for animations such as the recognition progress spinner and animated totals.
