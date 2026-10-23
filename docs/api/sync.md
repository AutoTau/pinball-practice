# Sync API contract

Status: **implemented** on the API (Sprint 3); the phone side is next.

The phone's SQLite database is the source of truth (decision 4). Sync moves records between it and the server in two steps, always in this order:

1. **Push** every local record changed since it was last pushed.
2. **Pull** every server record changed since the device's cursor, page by page.

Practice data has one writer per user, so conflicts are rare; when they happen, the newer `updatedAt` wins (decision 5).

## Common rules

- **Auth.** Every request carries a Cognito access token (decision 39) as `Authorization: Bearer`. The user comes from its `sub`, never from the body; the server creates the user on first sign-in. A record owned by another user is rejected as `not found`, exactly like a missing one.
- **IDs.** Every record's `id` is a UUID generated on the device. The server never assigns one.
- **Times.** ISO 8601 with offset, e.g. `2026-10-22T19:04:11.512Z`.
- **Deletes.** A delete is an update that sets `deletedAt` (decision 17). Records are never removed.
- **Names.** JSON is camelCase; tables are listed parent first: `machineInstances`, `sessions`, `games`, `balls`, `notes`.
- **Clock skew.** The server rejects any `updatedAt` more than 5 minutes in its future, so a phone with a wrong clock can't win every conflict forever.

## Record shapes

Every record carries these fields; the server-only `userId` and `syncXid` are never sent or returned.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Client-generated |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | Client clock; decides conflicts |
| `deletedAt` | timestamp or null | Soft delete |

Plus, per table:

| Table | Fields |
| --- | --- |
| `machineInstances` | `opdbMachineId`, `opdbAliasId?`, `locationName`, `ballsPerGame`, `ballSaveSeconds?`, `tiltWarnings?` |
| `sessions` | `machineInstanceId`, `codeVersion?`, `ballsPerGame`, `ballSaveSeconds?`, `tiltWarnings?`, `startedAt`, `endedAt?`, `source` (`manual` \| `photo` \| `voice`) |
| `games` | `sessionId`, `gameNumber`, `playerCount`, `finalScore?` |
| `balls` | `gameId`, `sequence`, `ballNumber`, `cumulativeScore`, `drainReason?`, `isExtraBall`, `tilted` |
| `notes` | `gameId?` or `ballId?` (exactly one), `body` |

Scores are JSON numbers. They fit safely: JavaScript represents integers exactly up to 9 quadrillion.

## Push

`POST /sync/push`

```json
{
  "deviceId": "6f1c2c8e-1d1f-4a55-9a43-0b7f3c1e9d20",
  "machineInstances": [],
  "sessions": [
    {
      "id": "0b6b0a1e-8f0d-4c59-9a8e-2f1f6f1c7a11",
      "createdAt": "2026-10-22T19:00:02Z",
      "updatedAt": "2026-10-22T19:00:02Z",
      "deletedAt": null,
      "machineInstanceId": "c1d0e5a4-3b7e-4d0b-9f5e-5a0c2d8b6e33",
      "codeVersion": "1.03",
      "ballsPerGame": 3,
      "ballSaveSeconds": 10,
      "tiltWarnings": 2,
      "startedAt": "2026-10-22T19:00:00Z",
      "endedAt": null,
      "source": "manual"
    }
  ],
  "games": [],
  "balls": [],
  "notes": []
}
```

At most 500 records per push; the client splits larger backlogs.

**Server behavior.** One transaction, tables in parent-first order. Each record gets its own result:

| Result | When | What the client does |
| --- | --- | --- |
| `applied` | New record inserted, or incoming `updatedAt` newer than the stored one | Mark synced |
| `stale` | Stored record is as new or newer | Mark synced; the next pull brings the newer copy |
| `rejected` | Invalid, owned by another user, parent missing or rejected, or clock skew | Keep it unsynced and surface the `reason`; don't retry blindly |

One bad record doesn't block the rest of the push. Pushing the same records twice is safe: the second push returns `stale`.

```json
{
  "results": [
    { "table": "sessions", "id": "0b6b0a1e-8f0d-4c59-9a8e-2f1f6f1c7a11", "status": "applied" },
    { "table": "balls", "id": "9d2e…", "status": "rejected", "reason": "parent game not found" }
  ]
}
```

## Pull

`GET /sync/pull?cursor=<cursor>&limit=500`

- Omit `cursor` on a device's first sync to receive everything.
- `limit` defaults to 500, maximum 1000.

```json
{
  "machineInstances": [],
  "sessions": [ { "id": "0b6b0a1e-…", "updatedAt": "2026-10-22T19:00:02Z", "...": "..." } ],
  "games": [],
  "balls": [],
  "notes": [],
  "cursor": "eyJ4IjoxNDgyMiwiaSI6IjBiNmIifQ",
  "hasMore": false
}
```

- The response includes soft-deleted records, so deletes reach every device.
- It includes records this device pushed; applying them is a no-op under the same newer-wins rule.
- The cursor is opaque: the client stores it and sends it back, never parses it.
- **A page is not parent-complete.** Rows arrive in the order they were last written, so a ball can arrive a page before an edited version of its game. Apply pulled pages without enforcing foreign keys (in SQLite, turn `foreign_keys` off for the pull); the server already enforced them.
- The client applies each page and saves the new cursor in **one SQLite transaction**, then keeps pulling while `hasMore` is true. If the app dies mid-sync, it resumes from the last saved cursor.

## Cursor guarantee (decision 32)

A pull must never skip a record. A plain "position greater than my cursor" check on a sequence can: two transactions can take sequence numbers in one order and commit in the other, so a reader moves its cursor past a number whose row isn't visible yet and misses it for good.

Instead, a trigger stamps each row with the ID of the transaction that last wrote it (`sync_xid`, Postgres `xid8`). A pull returns rows that are:

- above the cursor, ordered by `(sync_xid, table, id)`, and
- below `pg_snapshot_xmin(pg_current_snapshot())`, the oldest transaction still running.

Every transaction below that boundary has finished, so no row can ever appear behind it later. While `hasMore` is true the cursor is the last row returned; when the page runs out it becomes the boundary itself. The cursor is that position encoded as base64url JSON, opaque to the client.

One cost: a long-running transaction anywhere in the database holds the boundary back, so pulls lag until it ends. The daily catalog import takes about 2 seconds, so this is negligible today.

## Errors

| Status | Meaning |
| --- | --- |
| 400 | Malformed body or query |
| 401 | Missing or invalid token |
| 413 | More than 500 records in a push |
| 429 | Rate limited (default 120 requests a minute per user, `RateLimits:SyncPerMinute`); retry after the `Retry-After` header |

## Source of truth

The C# types in `api/src/Modules/Sessions/Pinball.Modules.Sessions/Sync/SyncContracts.cs` define the wire shapes and are published in the OpenAPI document at `/openapi/v1.json` (Development). The behavior is pinned by `api/tests/Pinball.IntegrationTests/SyncTests.cs`.
