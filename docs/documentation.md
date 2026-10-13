# Documentation

Read this guide when creating or changing repository documentation, product specifications, runbooks, or prose comments.

## Content

- Keep documentation as a current-state specification. State the chosen model, ownership, invariants, and behaviour directly.
- Put rejected designs and historical narration only in an explicitly historical document such as `CHANGELOG.md`, a migration note, or a postmortem.
- Preserve user-provided text, quotations, APIs, schemas, and established product terminology.
- Use clear technical language, short grammatical sentences, active voice, and consistent terms. Repository guides and `README.md` are written in English; `CHANGELOG.md` is written in Chinese.
- Keep guidance close to its owner: repository-wide rules in `AGENTS.md`, `ARCHITECTURE.md`, `CODE.md` and `docs/`, data-specific notes beside the data (for example `data/README.md`), and temporary implementation plans outside current-state guides.
- When an implementation plan is completed, promote only its surviving behaviour into the owning current-state document. Do not leave completed plans as competing specifications.
- Link to the authoritative specialised guide instead of duplicating its rules. Fix a nearby stale link when the correction is small; ask before expanding into broad documentation cleanup.
- Never copy secrets, account identifiers, vault names, personal data or private notes into documentation. The repository is public.

## Markdown

- Keep each prose paragraph and list item on one source line and let the renderer wrap it.
- Use headings for sections and plain text for list labels.
- Do not use bold text as a pseudo-heading. Reserve bold for genuine emphasis within prose.
- Use explicit line breaks only when they represent a real semantic boundary or the format requires them.
- Link to files with relative paths so links work on GitHub and in editors.
