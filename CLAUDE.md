# CLAUDE.md

Pinball practice tracker: offline-first React Native app plus an ASP.NET Core modular-monolith API on PostgreSQL. The plan is in `docs/plan.md`; decisions are in `docs/decisions.md`.

## Rules

- **Small commits.** Break every feature into multiple small, self-contained commits. Never land a feature as one large commit.
- **AWS and DevOps are read-only** unless the user explicitly says otherwise in the current conversation. No creating, changing or deleting cloud resources, pipelines' secrets, DNS, IAM or deployments.
- **No commits Monday–Friday, 8:00am–5:00pm Pacific.** Check the Pacific time before every commit. The `.githooks/pre-commit` hook enforces this; never bypass it with `--no-verify`.
- **Record decisions.** Any choice with real alternatives gets a row in `docs/decisions.md` the same day: newest at the top, never delete rows, mark replaced ones Superseded.

## Layout

- `api/` — .NET solution. `src/Pinball.Api` is the host (composition only). Each module in `src/Modules/<Name>` owns its own Postgres schema, DbContext and migrations; modules never reference each other's internals and there are no cross-module foreign keys.
- `mobile/` — Expo + TypeScript app. SQLite on the device is the source of truth.
- `.githooks/` — shared git hooks. One-time setup per clone: `git config core.hooksPath .githooks`.

## Sync conventions

Every user-owned table has: client-generated `id` (UUID), `user_id`, `created_at`, `updated_at` (last-write-wins), `deleted_at` (soft delete; never hard-delete synced rows) and a server-assigned `sync_seq` used as the pull cursor.

## Commands

- API tests: `dotnet test api/Pinball.slnx`
- Local Postgres: `docker compose up -d`
- New migration: `dotnet ef migrations add <Name> -p api/src/Modules/<Module>/Pinball.Modules.<Module> -s api/src/Pinball.Api -c <Module>DbContext`
