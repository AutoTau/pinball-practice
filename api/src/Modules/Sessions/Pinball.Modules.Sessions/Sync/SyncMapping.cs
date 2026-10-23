using Pinball.Modules.Sessions.Domain;
using Pinball.SharedKernel.Sync;

namespace Pinball.Modules.Sessions.Sync;

/// <summary>Copies between wire shapes and entities. Server-only fields (UserId, SyncXid) never cross.</summary>
internal static class SyncMapping
{
    public static void CopyCommon(SyncRecordDto from, SyncEntity to)
    {
        to.CreatedAt = from.CreatedAt;
        to.UpdatedAt = from.UpdatedAt;
        to.DeletedAt = from.DeletedAt;
    }

    public static void Copy(MachineInstanceDto d, MachineInstance e)
    {
        CopyCommon(d, e);
        e.OpdbMachineId = d.OpdbMachineId;
        e.OpdbAliasId = d.OpdbAliasId;
        e.LocationName = d.LocationName;
        e.BallsPerGame = d.BallsPerGame;
        e.BallSaveSeconds = d.BallSaveSeconds;
        e.TiltWarnings = d.TiltWarnings;
    }

    public static void Copy(SessionDto d, Session e)
    {
        CopyCommon(d, e);
        e.MachineInstanceId = d.MachineInstanceId;
        e.CodeVersion = d.CodeVersion;
        e.BallsPerGame = d.BallsPerGame;
        e.BallSaveSeconds = d.BallSaveSeconds;
        e.TiltWarnings = d.TiltWarnings;
        e.StartedAt = d.StartedAt;
        e.EndedAt = d.EndedAt;
        e.Source = (SessionSource)d.Source;
    }

    public static void Copy(GameDto d, Game e)
    {
        CopyCommon(d, e);
        e.SessionId = d.SessionId;
        e.GameNumber = d.GameNumber;
        e.PlayerCount = d.PlayerCount;
        e.FinalScore = d.FinalScore;
    }

    public static void Copy(BallDto d, Ball e)
    {
        CopyCommon(d, e);
        e.GameId = d.GameId;
        e.Sequence = d.Sequence;
        e.BallNumber = d.BallNumber;
        e.CumulativeScore = d.CumulativeScore;
        e.DrainReason = d.DrainReason;
        e.IsExtraBall = d.IsExtraBall;
        e.Tilted = d.Tilted;
    }

    public static void Copy(NoteDto d, Note e)
    {
        CopyCommon(d, e);
        e.GameId = d.GameId;
        e.BallId = d.BallId;
        e.Body = d.Body;
    }

    public static MachineInstanceDto ToDto(MachineInstance e) => new()
    {
        Id = e.Id, CreatedAt = e.CreatedAt, UpdatedAt = e.UpdatedAt, DeletedAt = e.DeletedAt,
        OpdbMachineId = e.OpdbMachineId, OpdbAliasId = e.OpdbAliasId, LocationName = e.LocationName,
        BallsPerGame = e.BallsPerGame, BallSaveSeconds = e.BallSaveSeconds, TiltWarnings = e.TiltWarnings,
    };

    public static SessionDto ToDto(Session e) => new()
    {
        Id = e.Id, CreatedAt = e.CreatedAt, UpdatedAt = e.UpdatedAt, DeletedAt = e.DeletedAt,
        MachineInstanceId = e.MachineInstanceId, CodeVersion = e.CodeVersion, BallsPerGame = e.BallsPerGame,
        BallSaveSeconds = e.BallSaveSeconds, TiltWarnings = e.TiltWarnings, StartedAt = e.StartedAt,
        EndedAt = e.EndedAt, Source = (SessionSourceDto)e.Source,
    };

    public static GameDto ToDto(Game e) => new()
    {
        Id = e.Id, CreatedAt = e.CreatedAt, UpdatedAt = e.UpdatedAt, DeletedAt = e.DeletedAt,
        SessionId = e.SessionId, GameNumber = e.GameNumber, PlayerCount = e.PlayerCount, FinalScore = e.FinalScore,
    };

    public static BallDto ToDto(Ball e) => new()
    {
        Id = e.Id, CreatedAt = e.CreatedAt, UpdatedAt = e.UpdatedAt, DeletedAt = e.DeletedAt,
        GameId = e.GameId, Sequence = e.Sequence, BallNumber = e.BallNumber, CumulativeScore = e.CumulativeScore,
        DrainReason = e.DrainReason, IsExtraBall = e.IsExtraBall, Tilted = e.Tilted,
    };

    public static NoteDto ToDto(Note e) => new()
    {
        Id = e.Id, CreatedAt = e.CreatedAt, UpdatedAt = e.UpdatedAt, DeletedAt = e.DeletedAt,
        GameId = e.GameId, BallId = e.BallId, Body = e.Body,
    };
}
