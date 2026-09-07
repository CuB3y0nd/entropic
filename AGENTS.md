# AGENTS.md

## Git

- `master` is stable and the only long-lived branch.
- Start new work from the latest `origin/master`:
  - `feat/<short-name>` for features
  - `fix/<short-name>` for bug fixes
  - `ci/<short-name>` for CI-only changes
  - `docs/<short-name>` for docs-only changes
  - `hotfix/<short-name>` for urgent production fixes
- Open pull requests against `master` and squash merge after required checks
  pass.
- Delete the work branch locally and on `origin` after merging.
- Commit with `git commit -S`.
- Use Conventional Commits: `<type>[optional scope]: <description>`.
- Write a commit body when the subject alone does not explain the why, tradeoff,
  or verification.

## Commands

- `pnpm install --frozen-lockfile`
- `pnpm format`
- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm assets:fonts` after changing CJK font coverage
