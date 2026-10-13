# Git commits and pull requests

Read this guide for authorised commits, pushes and PR creation. Git writes require the authorisation described in [AGENTS.md](../AGENTS.md). A request to create a PR authorises its branch, commits and push, but does not authorise merging or deployment.

## Titles and review

Use Conventional Commits: `type(scope): concise description`, with the owning feature as the scope (`recognition`, `recommendation`, `profile`, `daily-log`, `account`, `feedback`, `agent`, `api`, `ui`, `db`). PR titles describe the aggregate change. Keep related implementation and tests together, and describe the final behaviour, validation, review order and deployment boundary. Use a body file for multiline PR descriptions so intentional newlines remain intact.

Work on a branch, never directly on `main`. Preserve other people's work. History rewrites require explicit authorisation for the exact target and operation; retain a recoverable backup before a destructive rewrite.

Before every commit, check `git status --short` for files that must stay local; see [setup](setup.md#open-source-release-checklist).

## Fallback when 1Password is unavailable

Commit signing and push authentication can fail separately. For already-authorised work, use unsigned commits and HTTPS through the existing `gh` login, per command, without unlocking 1Password or changing persistent Git settings, remotes or keys. If the user or repository requires signed commits, report the blocker instead.

```sh
git -c commit.gpgsign=false commit -m 'fix(recognition): keep local matches when search fails'
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push https://github.com/OWNER/REPO.git BRANCH
gh pr create --repo OWNER/REPO --base BASE --head BRANCH --title '...' --body-file /path/to/pr-body.md
```

Confirm the destination with `git remote get-url origin` and use the HTTPS URL of that same repository. Clearing the credential-helper chain applies only to that command; `gh` supplies credentials without printing tokens. If it has no usable login, report the limitation instead of creating one implicitly. State when fallback commits are unsigned.
