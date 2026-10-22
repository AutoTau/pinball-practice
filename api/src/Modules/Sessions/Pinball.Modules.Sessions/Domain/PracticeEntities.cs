using Pinball.SharedKernel.Sync;

namespace Pinball.Modules.Sessions.Domain;

public class User
{
    public Guid Id { get; set; }

    /// <summary>Subject claim from the auth provider; null until auth is chosen.</summary>
    public string? AuthSubject { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>A physical machine the player practices on (identity level 3 of 4, decision 8).</summary>
public class MachineInstance : SyncEntity
{
    /// <summary>OPDB edition ID. Not a foreign key: catalog is another module (decision 21).</summary>
    public required string OpdbMachineId { get; set; }
    public string? OpdbAliasId { get; set; }
    public required string LocationName { get; set; }

    // Current settings; each session takes a copy (decision 19).
    public short BallsPerGame { get; set; } = 3;
    public short? BallSaveSeconds { get; set; }
    public short? TiltWarnings { get; set; }
}

public enum SessionSource
{
    Manual,
    Photo,
    Voice,
}

public class Session : SyncEntity
{
    public Guid MachineInstanceId { get; set; }

    // Identity level 4: code version plus the settings in force for this session.
    public string? CodeVersion { get; set; }
    public short BallsPerGame { get; set; }
    public short? BallSaveSeconds { get; set; }
    public short? TiltWarnings { get; set; }

    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public SessionSource Source { get; set; }
}

public class Game : SyncEntity
{
    public Guid SessionId { get; set; }
    public short GameNumber { get; set; }
    public short PlayerCount { get; set; } = 1;
    public long? FinalScore { get; set; }
}

/// <summary>
/// One ball played. Delta is not stored: the <c>practice.ball_deltas</c> view derives it (decision 22).
/// </summary>
public class Ball : SyncEntity
{
    public Guid GameId { get; set; }

    /// <summary>Order within the game; unlike <see cref="BallNumber"/> it never repeats on an extra ball.</summary>
    public short Sequence { get; set; }

    public short BallNumber { get; set; }
    public long CumulativeScore { get; set; }

    /// <summary>Drain chip code, validated in code rather than by the database (decision 23).</summary>
    public string? DrainReason { get; set; }

    public bool IsExtraBall { get; set; }
    public bool Tilted { get; set; }
}

/// <summary>Attached to exactly one game or one ball.</summary>
public class Note : SyncEntity
{
    public Guid? GameId { get; set; }
    public Guid? BallId { get; set; }
    public required string Body { get; set; }
}
