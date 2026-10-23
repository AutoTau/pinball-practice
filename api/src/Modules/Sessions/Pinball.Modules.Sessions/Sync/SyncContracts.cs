using System.Text.Json.Serialization;

namespace Pinball.Modules.Sessions.Sync;

// Wire shapes for /sync/push and /sync/pull. The prose contract is docs/api/sync.md; keep the two in step.
// These are separate from the entities so server-only columns (user_id, sync_xid) never reach the wire.

public static class SyncLimits
{
    public const int MaxPushRecords = 500;
    public const int DefaultPullLimit = 500;
    public const int MaxPullLimit = 1000;

    /// <summary>Pushed <c>updatedAt</c> values further ahead of the server clock are rejected (decision 34).</summary>
    public static readonly TimeSpan MaxClockSkew = TimeSpan.FromMinutes(5);
}

/// <summary>Fields every synced record carries.</summary>
public abstract record SyncRecordDto
{
    public required Guid Id { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>Client clock; the newer value wins a conflict.</summary>
    public required DateTimeOffset UpdatedAt { get; init; }

    /// <summary>Set to delete; records are never removed (decision 17).</summary>
    public DateTimeOffset? DeletedAt { get; init; }
}

public sealed record MachineInstanceDto : SyncRecordDto
{
    public required string OpdbMachineId { get; init; }
    public string? OpdbAliasId { get; init; }
    public required string LocationName { get; init; }
    public required short BallsPerGame { get; init; }
    public short? BallSaveSeconds { get; init; }
    public short? TiltWarnings { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<SessionSourceDto>))]
public enum SessionSourceDto
{
    [JsonStringEnumMemberName("manual")] Manual,
    [JsonStringEnumMemberName("photo")] Photo,
    [JsonStringEnumMemberName("voice")] Voice,
}

public sealed record SessionDto : SyncRecordDto
{
    public required Guid MachineInstanceId { get; init; }
    public string? CodeVersion { get; init; }
    public required short BallsPerGame { get; init; }
    public short? BallSaveSeconds { get; init; }
    public short? TiltWarnings { get; init; }
    public required DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? EndedAt { get; init; }
    public required SessionSourceDto Source { get; init; }
}

public sealed record GameDto : SyncRecordDto
{
    public required Guid SessionId { get; init; }
    public required short GameNumber { get; init; }
    public required short PlayerCount { get; init; }
    public long? FinalScore { get; init; }
}

public sealed record BallDto : SyncRecordDto
{
    public required Guid GameId { get; init; }
    public required short Sequence { get; init; }
    public required short BallNumber { get; init; }
    public required long CumulativeScore { get; init; }
    public string? DrainReason { get; init; }
    public bool IsExtraBall { get; init; }
    public bool Tilted { get; init; }
}

public sealed record NoteDto : SyncRecordDto
{
    /// <summary>Exactly one of <see cref="GameId"/> and <see cref="BallId"/> is set.</summary>
    public Guid? GameId { get; init; }
    public Guid? BallId { get; init; }
    public required string Body { get; init; }
}

/// <summary>Records grouped by table, parent first.</summary>
public abstract record SyncBatch
{
    public IReadOnlyList<MachineInstanceDto> MachineInstances { get; init; } = [];
    public IReadOnlyList<SessionDto> Sessions { get; init; } = [];
    public IReadOnlyList<GameDto> Games { get; init; } = [];
    public IReadOnlyList<BallDto> Balls { get; init; } = [];
    public IReadOnlyList<NoteDto> Notes { get; init; } = [];

    public int Count => MachineInstances.Count + Sessions.Count + Games.Count + Balls.Count + Notes.Count;
}

public sealed record PushRequest : SyncBatch
{
    public required Guid DeviceId { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<PushStatus>))]
public enum PushStatus
{
    /// <summary>Inserted, or newer than the stored copy.</summary>
    [JsonStringEnumMemberName("applied")] Applied,

    /// <summary>The server's copy is as new or newer; the next pull delivers it.</summary>
    [JsonStringEnumMemberName("stale")] Stale,

    /// <summary>Not stored; <see cref="PushResult.Reason"/> says why.</summary>
    [JsonStringEnumMemberName("rejected")] Rejected,
}

/// <param name="Table">camelCase table name, e.g. <c>balls</c>.</param>
public sealed record PushResult(string Table, Guid Id, PushStatus Status, string? Reason = null);

public sealed record PushResponse(IReadOnlyList<PushResult> Results);

public sealed record PullResponse : SyncBatch
{
    /// <summary>Opaque; the client stores it and sends it back unchanged.</summary>
    public required string Cursor { get; init; }

    public required bool HasMore { get; init; }
}
