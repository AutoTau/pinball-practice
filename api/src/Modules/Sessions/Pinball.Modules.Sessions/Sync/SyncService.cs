using Microsoft.EntityFrameworkCore;
using Pinball.Modules.Sessions.Data;
using Pinball.Modules.Sessions.Domain;
using Pinball.SharedKernel.Sync;

namespace Pinball.Modules.Sessions.Sync;

/// <summary>Implements the sync contract in docs/api/sync.md.</summary>
public sealed class SyncService(PracticeDbContext db, TimeProvider clock)
{
    // Pull order within one transaction ID: parents before children.
    private const int MachineInstances = 0, Sessions = 1, Games = 2, Balls = 3, Notes = 4;

    /// <summary>
    /// Applies a push: one transaction, tables parent first, a result per record (decision 33). Each record
    /// gets a savepoint, so one that trips a database constraint is rejected without losing the others.
    /// </summary>
    public async Task<PushResponse> PushAsync(Guid userId, PushRequest request, CancellationToken ct)
    {
        var results = new List<PushResult>(request.Count);
        var latestAllowed = clock.GetUtcNow() + SyncLimits.MaxClockSkew;

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        foreach (var d in request.MachineInstances)
            results.Add(await ApplyAsync("machineInstances", d, db.MachineInstances, userId, latestAllowed,
                Validate(d), () => Task.FromResult(true),
                () => new MachineInstance { OpdbMachineId = d.OpdbMachineId, LocationName = d.LocationName }, SyncMapping.Copy, ct));

        foreach (var d in request.Sessions)
            results.Add(await ApplyAsync("sessions", d, db.Sessions, userId, latestAllowed,
                Validate(d), () => Owns(db.MachineInstances, d.MachineInstanceId, userId, ct), () => new Session(), SyncMapping.Copy, ct));

        foreach (var d in request.Games)
            results.Add(await ApplyAsync("games", d, db.Games, userId, latestAllowed,
                Validate(d), () => Owns(db.Sessions, d.SessionId, userId, ct), () => new Game(), SyncMapping.Copy, ct));

        foreach (var d in request.Balls)
            results.Add(await ApplyAsync("balls", d, db.Balls, userId, latestAllowed,
                Validate(d), () => Owns(db.Games, d.GameId, userId, ct), () => new Ball(), SyncMapping.Copy, ct));

        foreach (var d in request.Notes)
            results.Add(await ApplyAsync("notes", d, db.Notes, userId, latestAllowed,
                Validate(d),
                async () => d.GameId is { } g ? await Owns(db.Games, g, userId, ct) : await Owns(db.Balls, d.BallId!.Value, userId, ct),
                () => new Note { Body = d.Body }, SyncMapping.Copy, ct));

        await tx.CommitAsync(ct);
        return new PushResponse(results);
    }

    private async Task<PushResult> ApplyAsync<TEntity, TDto>(
        string table,
        TDto dto,
        DbSet<TEntity> set,
        Guid userId,
        DateTimeOffset latestAllowed,
        string? invalid,
        Func<Task<bool>> parentOwned,
        Func<TEntity> create,
        Action<TDto, TEntity> copy,
        CancellationToken ct)
        where TEntity : SyncEntity
        where TDto : SyncRecordDto
    {
        PushResult Rejected(string reason) => new(table, dto.Id, PushStatus.Rejected, reason);

        if (invalid is not null) return Rejected(invalid);
        if (dto.UpdatedAt > latestAllowed) return Rejected("updatedAt is ahead of the server clock");

        var existing = await set.FindAsync([dto.Id], ct);
        // Someone else's ID is answered exactly like a missing parent, so IDs can't be probed.
        if (existing is not null && existing.UserId != userId) return Rejected("not found");
        if (existing is not null && ToStoredPrecision(dto.UpdatedAt) <= existing.UpdatedAt)
            return new PushResult(table, dto.Id, PushStatus.Stale);
        if (!await parentOwned()) return Rejected("parent not found");

        var entity = existing;
        if (entity is null)
        {
            entity = create();
            entity.Id = dto.Id;
            entity.UserId = userId;
            set.Add(entity);
        }
        copy(dto, entity);

        var savepoint = $"r{Guid.NewGuid():N}";
        await db.Database.CurrentTransaction!.CreateSavepointAsync(savepoint, ct);
        try
        {
            await db.SaveChangesAsync(ct);
            return new PushResult(table, dto.Id, PushStatus.Applied);
        }
        catch (DbUpdateException)
        {
            await db.Database.CurrentTransaction!.RollbackToSavepointAsync(savepoint, ct);
            var entry = db.Entry(entity);
            if (existing is null) entry.State = EntityState.Detached;
            else await entry.ReloadAsync(ct);
            return Rejected("conflicts with stored data, e.g. a duplicate ball sequence");
        }
    }

    /// <summary>Postgres keeps microseconds; .NET keeps 100 ns ticks. Compare as stored, or a re-push looks newer.</summary>
    private static DateTimeOffset ToStoredPrecision(DateTimeOffset value) => value.AddTicks(-(value.Ticks % 10));

    private static Task<bool> Owns<TEntity>(DbSet<TEntity> set, Guid id, Guid userId, CancellationToken ct)
        where TEntity : SyncEntity =>
        set.AnyAsync(e => e.Id == id && e.UserId == userId, ct);

    // Mirrors the database's check constraints and column sizes, so ordinary bad input gets a clear reason.
    private static string? Validate(MachineInstanceDto d) =>
        string.IsNullOrWhiteSpace(d.OpdbMachineId) || d.OpdbMachineId.Length > 50 ? "opdbMachineId is required (max 50)"
        : d.OpdbAliasId?.Length > 50 ? "opdbAliasId is too long"
        : string.IsNullOrWhiteSpace(d.LocationName) || d.LocationName.Length > 200 ? "locationName is required (max 200)"
        : d.BallsPerGame is < 1 or > 10 ? "ballsPerGame must be 1-10"
        : null;

    private static string? Validate(SessionDto d) =>
        d.BallsPerGame is < 1 or > 10 ? "ballsPerGame must be 1-10"
        : d.CodeVersion?.Length > 50 ? "codeVersion is too long"
        : !Enum.IsDefined(d.Source) ? "source is not recognized"
        : null;

    private static string? Validate(GameDto d) =>
        d.GameNumber < 1 ? "gameNumber must be 1 or more"
        : d.PlayerCount is < 1 or > 6 ? "playerCount must be 1-6"
        : d.FinalScore < 0 ? "finalScore can't be negative"
        : null;

    private static string? Validate(BallDto d) =>
        d.Sequence < 1 ? "sequence must be 1 or more"
        : d.BallNumber < 1 ? "ballNumber must be 1 or more"
        : d.CumulativeScore < 0 ? "cumulativeScore can't be negative"
        : d.DrainReason?.Length > 50 ? "drainReason is too long"
        : null;

    private static string? Validate(NoteDto d) =>
        (d.GameId is null) == (d.BallId is null) ? "a note needs exactly one of gameId and ballId"
        : string.IsNullOrWhiteSpace(d.Body) || d.Body.Length > 4000 ? "body is required (max 4000)"
        : null;

    /// <summary>
    /// Returns the user's rows changed after the cursor, oldest first (decision 32). Only rows whose
    /// transaction finished before every still-running one are returned, so nothing can land behind the
    /// cursor later. Rows and the boundary come from one statement, so they share one snapshot.
    /// </summary>
    public async Task<PullResponse> PullAsync(Guid userId, SyncCursor after, int limit, CancellationToken ct)
    {
        var take = Math.Clamp(limit, 1, SyncLimits.MaxPullLimit);

        var positions = await db.Database.SqlQuery<PullPosition>($"""
            WITH boundary AS (SELECT pg_snapshot_xmin(pg_current_snapshot()) AS xmin),
            changes AS (
                SELECT 0 AS table_rank, id, sync_xid FROM practice.machine_instances WHERE user_id = {userId}
                UNION ALL SELECT 1, id, sync_xid FROM practice.sessions WHERE user_id = {userId}
                UNION ALL SELECT 2, id, sync_xid FROM practice.games WHERE user_id = {userId}
                UNION ALL SELECT 3, id, sync_xid FROM practice.balls WHERE user_id = {userId}
                UNION ALL SELECT 4, id, sync_xid FROM practice.notes WHERE user_id = {userId}
            )
            SELECT b.xmin::text AS boundary, c.table_rank, c.id, c.sync_xid::text AS xid
            FROM boundary b
            LEFT JOIN LATERAL (
                SELECT * FROM changes c
                WHERE c.sync_xid < b.xmin
                  AND (c.sync_xid, c.table_rank, c.id) > ({after.Xid.ToString()}::xid8, {after.Table}, {after.Id})
                ORDER BY c.sync_xid, c.table_rank, c.id
                LIMIT {take + 1}
            ) c ON true
            """).ToListAsync(ct);

        var rows = positions.Where(p => p.Id is not null).ToList();
        var hasMore = rows.Count > take;
        if (hasMore) rows.RemoveAt(rows.Count - 1);

        var cursor = hasMore
            ? new SyncCursor(ulong.Parse(rows[^1].Xid!), rows[^1].TableRank!.Value, rows[^1].Id!.Value)
            // Everything below the boundary has been delivered; resume exactly at it.
            : new SyncCursor(ulong.Parse(positions[0].Boundary), -1, Guid.Empty);

        IReadOnlyList<Guid> Ids(int rank) => rows.Where(r => r.TableRank == rank).Select(r => r.Id!.Value).ToList();

        return new PullResponse
        {
            MachineInstances = await LoadAsync(db.MachineInstances, Ids(MachineInstances), SyncMapping.ToDto, ct),
            Sessions = await LoadAsync(db.Sessions, Ids(Sessions), SyncMapping.ToDto, ct),
            Games = await LoadAsync(db.Games, Ids(Games), SyncMapping.ToDto, ct),
            Balls = await LoadAsync(db.Balls, Ids(Balls), SyncMapping.ToDto, ct),
            Notes = await LoadAsync(db.Notes, Ids(Notes), SyncMapping.ToDto, ct),
            Cursor = cursor.Encode(),
            HasMore = hasMore,
        };
    }

    private static async Task<IReadOnlyList<TDto>> LoadAsync<TEntity, TDto>(
        DbSet<TEntity> set, IReadOnlyList<Guid> ids, Func<TEntity, TDto> map, CancellationToken ct)
        where TEntity : SyncEntity
    {
        if (ids.Count == 0) return [];
        var byId = await set.AsNoTracking().Where(e => ids.Contains(e.Id)).ToDictionaryAsync(e => e.Id, ct);
        // Keep pull order. Rows are never hard-deleted, so every ID found by the position query is here.
        return ids.Where(byId.ContainsKey).Select(id => map(byId[id])).ToList();
    }

    internal sealed class PullPosition
    {
        public required string Boundary { get; init; }
        public int? TableRank { get; init; }
        public Guid? Id { get; init; }
        public string? Xid { get; init; }
    }
}
