# Pinball Practice Tracker

Log every ball at the machine, then see why you drain. An offline-first React Native app records each ball in one or two taps; an ASP.NET Core API syncs it and serves the machine catalog.

The plan is in [docs/plan.md](docs/plan.md); every design choice with real alternatives is in [docs/decisions.md](docs/decisions.md).

## What it does

- **Pick the machine you're on.** Search ~2,400 machines from the [Open Pinball Database](https://opdb.org) offline, typos and short names included ("godzila", "GZ"), with backglass art.
- **Log a ball in two taps.** Type the score on a dot-matrix panel, tap how it drained: outlanes, center, tilt, extra ball.
- **See your patterns.** Median and typical-range scores per machine, a rolling-median trend, points by ball, how your balls drain, and notes per ball. Medians, not averages: pinball scores are heavily skewed.
- **Works without signal.** The phone's SQLite database is the source of truth; sync catches up later.

## Architecture

```
Phone (Expo, TypeScript)                      API (ASP.NET Core, .NET 10)              External
┌─────────────────────────────┐              ┌──────────────────────────────┐
│ Screens (Expo Router)       │              │ Catalog module ──── daily ───┼──▶ OPDB export
│   └─ data layer (src/data)  │  /catalog    │   upsert + bad-file guards   │
│        └─ SQLite (Drizzle)  │◀─────────────┤                              │
│ Sync engine (src/sync)      │  /sync/push  │ Sessions module              │
│   push dirty rows, pull     │─────────────▶│   per-record push results    │
│   pages from a cursor       │◀─────────────┤   gap-free pull cursor       │
└─────────────────────────────┘  /sync/pull  └──────────────┬───────────────┘
                                                           PostgreSQL
                                                (schema per module, no cross-module FKs)
```

Some of the more interesting decisions:

- **Sync that never skips a record** ([#32](docs/decisions.md)). Rows carry the ID of the transaction that wrote them; a pull only returns rows below the oldest still-running transaction, so a slow writer can't commit "behind" a client's cursor. A test holds a transaction open to prove it.
- **Guarded catalog imports** ([#30](docs/decisions.md), [#31](docs/decisions.md)). The daily OPDB import upserts in one transaction and refuses a file that would shrink the catalog, retire more than 2% of it, or rename more than 5%.
- **Module boundaries enforced in code** ([#21](docs/decisions.md)). Each API module owns its Postgres schema and DbContext; architecture tests fail the build if one module references another.
- **Last-write-wins with guard rails** ([#5](docs/decisions.md), [#33](docs/decisions.md), [#34](docs/decisions.md)). Every pushed record gets its own result, and timestamps from a phone with a wrong clock are rejected.

## Repository layout

| Path | What |
| --- | --- |
| `api/` | .NET 10 modular monolith: Catalog and Sessions modules, PostgreSQL, xUnit + Testcontainers |
| `mobile/` | Expo SDK 58 + TypeScript: Expo Router, SQLite via Drizzle, Victory Native charts, Jest |
| `docs/` | Plan, decision log, sync contract (`docs/api/sync.md`) |
| `.githooks/` | Shared git hooks |

## Getting started

```bash
git config core.hooksPath .githooks   # once per clone
docker compose up -d                  # local Postgres
cd api
dotnet tool restore
dotnet ef database update -p src/Modules/Catalog/Pinball.Modules.Catalog -s src/Pinball.Api -c CatalogDbContext
dotnet ef database update -p src/Modules/Sessions/Pinball.Modules.Sessions -s src/Pinball.Api -c PracticeDbContext
dotnet run --project src/Pinball.Api --urls http://0.0.0.0:5080   # imports the OPDB catalog on first start
dotnet test Pinball.slnx              # integration tests need Docker running
docker build -t pinball-api .         # container image; CI builds it on every push
```

```bash
cd mobile
npm ci
npm test
npx expo start                        # scan the QR code with Expo Go on the same Wi-Fi
```

In development the app finds the API on the computer running Metro (port 5080); set `EXPO_PUBLIC_API_URL` to point elsewhere.

## Credits

Machine data and images come from the [Open Pinball Database](https://opdb.org). Backglass art belongs to its manufacturers; this is a free, non-commercial project ([#40](docs/decisions.md)).
