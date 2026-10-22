using Microsoft.EntityFrameworkCore;
using Pinball.Modules.Sessions.Data;
using Pinball.Modules.Sessions.Domain;

namespace Pinball.IntegrationTests;

[Collection(PostgresCollection.Name)]
public class PracticeSchemaTests(PostgresFixture db)
{
    [Fact]
    public async Task Insert_and_update_each_take_a_higher_sync_seq()
    {
        await using var ctx = db.CreatePractice();
        var (_, _, game) = await SeedGameAsync(ctx);

        var inserted = game.SyncSeq;
        game.FinalScore = 1_000_000;
        game.UpdatedAt = DateTimeOffset.UtcNow;
        await ctx.SaveChangesAsync();

        Assert.True(inserted > 0);
        Assert.True(game.SyncSeq > inserted);
    }

    [Fact]
    public async Task Ball_deltas_view_derives_delta_and_skips_deleted_balls()
    {
        await using var ctx = db.CreatePractice();
        var (user, _, game) = await SeedGameAsync(ctx);

        ctx.Balls.AddRange(
            NewBall(user, game, sequence: 1, score: 100_000_000),
            NewBall(user, game, sequence: 2, score: 340_000_000),
            NewBall(user, game, sequence: 3, score: 345_000_000, deleted: true),
            NewBall(user, game, sequence: 4, score: 500_000_000));
        await ctx.SaveChangesAsync();

        var deltas = await ctx.Database
            .SqlQuery<long>($"SELECT delta AS \"Value\" FROM practice.ball_deltas WHERE game_id = {game.Id} ORDER BY sequence")
            .ToListAsync();

        Assert.Equal([100_000_000L, 240_000_000L, 160_000_000L], deltas);
    }

    [Fact]
    public async Task Note_must_have_exactly_one_parent()
    {
        await using var ctx = db.CreatePractice();
        var (user, _, _) = await SeedGameAsync(ctx);

        ctx.Notes.Add(new Note
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Body = "orphan",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    private static async Task<(User, Session, Game)> SeedGameAsync(PracticeDbContext ctx)
    {
        var now = DateTimeOffset.UtcNow;
        var user = new User { Id = Guid.NewGuid(), CreatedAt = now };
        var machine = new MachineInstance
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            OpdbMachineId = "GrqZX-MQ6vP",
            LocationName = "Test Arcade",
            CreatedAt = now,
            UpdatedAt = now,
        };
        var session = new Session
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            MachineInstanceId = machine.Id,
            BallsPerGame = 3,
            StartedAt = now,
            Source = SessionSource.Manual,
            CreatedAt = now,
            UpdatedAt = now,
        };
        var game = new Game
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            SessionId = session.Id,
            GameNumber = 1,
            CreatedAt = now,
            UpdatedAt = now,
        };

        ctx.AddRange(user, machine, session, game);
        await ctx.SaveChangesAsync();
        return (user, session, game);
    }

    private static Ball NewBall(User user, Game game, short sequence, long score, bool deleted = false)
    {
        var now = DateTimeOffset.UtcNow;
        return new Ball
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            GameId = game.Id,
            Sequence = sequence,
            BallNumber = sequence,
            CumulativeScore = score,
            CreatedAt = now,
            UpdatedAt = now,
            DeletedAt = deleted ? now : null,
        };
    }
}
