# Pinball Practice Tracker

Offline-first pinball practice logging: a React Native app that records every ball, and an ASP.NET Core API that syncs and analyzes it. See [docs/plan.md](docs/plan.md) for the plan and [docs/decisions.md](docs/decisions.md) for design decisions.

## Repository layout

| Path | What |
| --- | --- |
| `api/` | .NET 10 modular monolith (Catalog, Sessions modules) on PostgreSQL |
| `mobile/` | Expo + TypeScript app (coming in Sprint 1) |
| `docs/` | Plan and decision log |
| `.githooks/` | Shared git hooks |

## Getting started

```bash
git config core.hooksPath .githooks   # once per clone
docker compose up -d                  # local Postgres
cd api
dotnet tool restore
dotnet test Pinball.slnx              # integration tests need Docker running
```
