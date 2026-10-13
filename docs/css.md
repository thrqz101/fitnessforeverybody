# CSS and Styling

Read this guide before changing Tailwind configuration, shared styles, or mobile behaviour.

## Architecture

The app has three style owners:

1. `tailwind.config.ts` owns the palette (`ink`, `paper`, `moss`, `mint`, `coral`, `citrus`, `skyglass`) and shadows (`soft`, `float`). It scans `src/**/*`.
2. `src/app/globals.css` owns base styles and component classes for the dashboard, calendar, recognition and recommendation surfaces.
3. `src/app/_shell/app-shell.css` owns the landing page, navigation, workspace shell and dialogs (`precision-*` classes).

The root layout imports both stylesheets once. Feature components use Tailwind utilities plus the semantic classes defined in these files; do not add per-component stylesheets.

## Tokens and utilities

Prefer palette tokens (`text-ink`, `bg-mint`, `border-moss/20`) over raw hex values in components. Use arbitrary values for an explicit design constraint, not to bypass an available token.

Tailwind must see complete class names in source. Literal strings inside functions, objects, or conditionals are detectable; constructed fragments such as `` `text-${tone}-700` `` are not. Tailwind also scans comments and prose in `src/`, so a word that matches a utility (for example `inline`) adds that utility to the bundle.

## Mobile baseline

The product is used mainly on phones.

- Check every UI change at a 375px-wide viewport with no horizontal page scroll.
- New full-height shells and dialogs use `100dvh` or `100svh` (as `.precision-dialog` does). Some existing surfaces still use `100vh`; replace them when you touch them and check the iOS browser chrome.
- Fixed and portalled overlays must apply relevant safe-area insets themselves when they touch a screen edge.
- When you add or change a text input, give it at least a 16px font size on coarse pointers to prevent iOS input zoom.
- Keep handwritten hover-only CSS inside `@media (hover: hover) and (pointer: fine)`. Touch users still need an immediate active state; tap highlights are disabled globally for buttons and links.
- Respect `prefers-reduced-motion` for every animation.

## Interaction states

A reusable control owns its complete state contract: resting, hover, active, focus-visible, disabled, and invalid. Every text/background pair must keep WCAG AA contrast in resting, hover, and active states. Do not rely on transition animation as the feedback itself; pressed feedback should begin on pointer-down.

The app has a single light theme (`colorScheme: "only light"` in the root layout).

## Verification

For a visual change: inspect the merged class list, check narrow viewport, keyboard, touch, long-content and both languages (English copy is usually longer), and run `npm run build`.
