using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Pinball.Modules.Sessions.Domain;
using Pinball.Modules.Sessions.Sync;

namespace Pinball.IntegrationTests;

// Each test signs in as a fresh user, so tests share the database without seeing each other's rows.
[Collection(PostgresCollection.Name)]
public class SyncTests(PostgresFixture db) : IAsyncLifetime
{
    private readonly SyncApi _api = new(db);
    private readonly DateTimeOffset _now = DateTimeOffset.UtcNow.AddMinutes(-10);

    public Task InitializeAsync() => Task.CompletedTask;
    public async Task DisposeAsync() => await _api.DisposeAsync();

    // ---------- helpers ----------

    private static string NewSubject() => $"user-{Guid.NewGuid():N}";

    private sealed record Tree(MachineInstanceDto Machine, SessionDto Session, GameDto Game, BallDto Ball, NoteDto Note);

    private Tree NewTree(DateTimeOffset? at = null)
    {
        var t = at ?? _now;
        var machine = new MachineInstanceDto
        {
            Id = Guid.NewGuid(), CreatedAt = t, UpdatedAt = t, OpdbMachineId = "GweeP-MW95j",
            LocationName = "Blair Alley", BallsPerGame = 3,
        };
        var session = new SessionDto
        {
            Id = Guid.NewGuid(), CreatedAt = t, UpdatedAt = t, MachineInstanceId = machine.Id, BallsPerGame = 3,
            StartedAt = t, Source = SessionSourceDto.Manual,
        };
        var game = new GameDto { Id = Guid.NewGuid(), CreatedAt = t, UpdatedAt = t, SessionId = session.Id, GameNumber = 1, PlayerCount = 1 };
        var ball = new BallDto
        {
            Id = Guid.NewGuid(), CreatedAt = t, UpdatedAt = t, GameId = game.Id, Sequence = 1, BallNumber = 1,
            CumulativeScore = 340_000_000, DrainReason = "left_outlane",
        };
        var note = new NoteDto { Id = Guid.NewGuid(), CreatedAt = t, UpdatedAt = t, GameId = game.Id, Body = "late on left ramp" };
        return new Tree(machine, session, game, ball, note);
    }

    private static PushRequest Push(Tree t) => new()
    {
        DeviceId = Guid.NewGuid(),
        MachineInstances = [t.Machine],
        Sessions = [t.Session],
        Games = [t.Game],
        Balls = [t.Ball],
        Notes = [t.Note],
    };

    private static async Task<PushResponse> PushAsync(HttpClient client, PushRequest request)
    {
        var response = await client.PostAsJsonAsync("/sync/push", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<PushResponse>())!;
    }

    private static async Task<PullResponse> PullAsync(HttpClient client, string? cursor = null, int? limit = null)
    {
        var query = new List<string>();
        if (cursor is not null) query.Add($"cursor={cursor}");
        if (limit is not null) query.Add($"limit={limit}");
        var response = await client.GetAsync("/sync/pull" + (query.Count > 0 ? "?" + string.Join('&', query) : ""));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<PullResponse>())!;
    }

    private static IEnumerable<Guid> AllIds(PullResponse p) =>
        p.MachineInstances.Select(r => r.Id).Concat(p.Sessions.Select(r => r.Id)).Concat(p.Games.Select(r => r.Id))
            .Concat(p.Balls.Select(r => r.Id)).Concat(p.Notes.Select(r => r.Id));

    // ---------- auth ----------

    [Fact]
    public async Task Requires_a_valid_access_token_for_this_app()
    {
        var anonymous = _api.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/sync/pull")).StatusCode);

        var otherApp = _api.ClientFor(NewSubject(), clientId: "someone-else");
        Assert.Equal(HttpStatusCode.Unauthorized, (await otherApp.GetAsync("/sync/pull")).StatusCode);

        var idToken = _api.ClientFor(NewSubject(), tokenUse: "id");
        Assert.Equal(HttpStatusCode.Unauthorized, (await idToken.GetAsync("/sync/pull")).StatusCode);
    }

    // ---------- push ----------

    [Fact]
    public async Task Pushes_a_whole_session_and_pulls_it_back()
    {
        var client = _api.ClientFor(NewSubject());
        var tree = NewTree();

        var pushed = await PushAsync(client, Push(tree));
        var pulled = await PullAsync(client);

        Assert.All(pushed.Results, r => Assert.Equal(PushStatus.Applied, r.Status));
        Assert.Equal(5, pushed.Results.Count);
        Assert.False(pulled.HasMore);
        Assert.Equal(340_000_000, Assert.Single(pulled.Balls).CumulativeScore);
        Assert.Equal("Blair Alley", Assert.Single(pulled.MachineInstances).LocationName);
        Assert.Equal(SessionSourceDto.Manual, Assert.Single(pulled.Sessions).Source);
        Assert.Equal("late on left ramp", Assert.Single(pulled.Notes).Body);
    }

    [Fact]
    public async Task Newer_edits_apply_and_older_or_repeated_ones_are_stale()
    {
        var client = _api.ClientFor(NewSubject());
        var tree = NewTree();
        await PushAsync(client, Push(tree));

        var again = await PushAsync(client, Push(tree));
        var newer = await PushAsync(client, new PushRequest
        {
            DeviceId = Guid.NewGuid(),
            Games = [tree.Game with { FinalScore = 900_000_000, UpdatedAt = _now.AddMinutes(1) }],
        });
        var older = await PushAsync(client, new PushRequest
        {
            DeviceId = Guid.NewGuid(),
            Games = [tree.Game with { FinalScore = 1, UpdatedAt = _now.AddSeconds(30) }],
        });

        Assert.All(again.Results, r => Assert.Equal(PushStatus.Stale, r.Status));
        Assert.Equal(PushStatus.Applied, Assert.Single(newer.Results).Status);
        Assert.Equal(PushStatus.Stale, Assert.Single(older.Results).Status);
        Assert.Equal(900_000_000, Assert.Single((await PullAsync(client)).Games).FinalScore);
    }

    [Fact]
    public async Task Rejects_bad_records_without_blocking_the_rest()
    {
        var client = _api.ClientFor(NewSubject());
        var tree = NewTree();
        var orphanBall = tree.Ball with { Id = Guid.NewGuid(), GameId = Guid.NewGuid(), Sequence = 2 };
        var duplicateSequence = tree.Ball with { Id = Guid.NewGuid() };
        var fromTheFuture = tree.Ball with { Id = Guid.NewGuid(), Sequence = 3, UpdatedAt = DateTimeOffset.UtcNow.AddHours(1) };
        var invalidNote = tree.Note with { Id = Guid.NewGuid(), BallId = tree.Ball.Id };

        var response = await PushAsync(client, Push(tree) with
        {
            Balls = [tree.Ball, orphanBall, duplicateSequence, fromTheFuture],
            Notes = [tree.Note, invalidNote],
        });

        var byId = response.Results.ToDictionary(r => r.Id);
        Assert.Equal(PushStatus.Applied, byId[tree.Ball.Id].Status);
        Assert.Equal(PushStatus.Applied, byId[tree.Note.Id].Status);
        Assert.Equal("parent not found", byId[orphanBall.Id].Reason);
        Assert.StartsWith("conflicts with stored data", byId[duplicateSequence.Id].Reason);
        Assert.Equal("updatedAt is ahead of the server clock", byId[fromTheFuture.Id].Reason);
        Assert.StartsWith("a note needs exactly one", byId[invalidNote.Id].Reason);
        Assert.Single((await PullAsync(client)).Balls);
    }

    [Fact]
    public async Task Another_users_records_are_invisible_and_cannot_be_overwritten()
    {
        var alice = _api.ClientFor(NewSubject());
        var mallory = _api.ClientFor(NewSubject());
        var tree = NewTree();
        await PushAsync(alice, Push(tree));

        var hijack = await PushAsync(mallory, new PushRequest
        {
            DeviceId = Guid.NewGuid(),
            MachineInstances = [tree.Machine with { LocationName = "Mine now", UpdatedAt = _now.AddMinutes(5) }],
            Sessions = [tree.Session with { Id = Guid.NewGuid() }], // child of Alice's machine
        });

        Assert.All(hijack.Results, r => Assert.Equal(PushStatus.Rejected, r.Status));
        Assert.Empty(AllIds(await PullAsync(mallory)));
        Assert.Equal("Blair Alley", Assert.Single((await PullAsync(alice)).MachineInstances).LocationName);
    }

    [Fact]
    public async Task Rejects_oversized_pushes_and_unknown_cursors()
    {
        var client = _api.ClientFor(NewSubject());
        var tooMany = new PushRequest
        {
            DeviceId = Guid.NewGuid(),
            Balls = Enumerable.Range(1, SyncLimits.MaxPushRecords + 1).Select(i => NewTree().Ball with { Sequence = (short)i }).ToList(),
        };

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await client.PostAsJsonAsync("/sync/push", tooMany)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/sync/pull?cursor=not-a-cursor")).StatusCode);
    }

    // ---------- pull ----------

    [Fact]
    public async Task Pages_through_everything_exactly_once_including_soft_deletes()
    {
        var client = _api.ClientFor(NewSubject());
        var trees = Enumerable.Range(0, 3).Select(_ => NewTree()).ToList();
        foreach (var t in trees) await PushAsync(client, Push(t));
        await PushAsync(client, new PushRequest
        {
            DeviceId = Guid.NewGuid(),
            Balls = [trees[0].Ball with { DeletedAt = _now.AddMinutes(1), UpdatedAt = _now.AddMinutes(1) }],
        });

        var seen = new List<Guid>();
        string? cursor = null;
        PullResponse page;
        var pages = 0;
        do
        {
            page = await PullAsync(client, cursor, limit: 4);
            seen.AddRange(AllIds(page));
            cursor = page.Cursor;
            pages++;
        }
        while (page.HasMore);

        Assert.Equal(15, seen.Count);
        Assert.Equal(15, seen.Distinct().Count());
        Assert.Equal(4, pages);

        var deleted = await PullAsync(client);
        Assert.NotNull(deleted.Balls.Single(b => b.Id == trees[0].Ball.Id).DeletedAt);

        var nothingNew = await PullAsync(client, cursor);
        Assert.Empty(AllIds(nothingNew));
        Assert.False(nothingNew.HasMore);
    }

    [Fact]
    public async Task A_pull_never_steps_past_a_write_that_is_still_in_flight()
    {
        var subject = NewSubject();
        var client = _api.ClientFor(subject);
        var first = NewTree();
        await PushAsync(client, Push(first));
        var caughtUp = (await PullAsync(client)).Cursor;

        await using var practice = db.CreatePractice();
        var userId = await practice.Users.Where(u => u.AuthSubject == subject).Select(u => u.Id).SingleAsync();

        // A slow writer opens a transaction and writes a game, but hasn't committed yet...
        var slowGame = new Game
        {
            Id = Guid.NewGuid(), UserId = userId, SessionId = first.Session.Id, GameNumber = 2,
            CreatedAt = _now, UpdatedAt = _now,
        };
        await using var slowTx = await practice.Database.BeginTransactionAsync();
        practice.Games.Add(slowGame);
        await practice.SaveChangesAsync();

        // ...while a fast push commits a later game.
        var fastGame = first.Game with { Id = Guid.NewGuid(), GameNumber = 3 };
        await PushAsync(client, new PushRequest { DeviceId = Guid.NewGuid(), Games = [fastGame] });

        var during = await PullAsync(client, caughtUp);
        await slowTx.CommitAsync();
        var after = await PullAsync(client, during.Cursor);

        // The fast game is held back until the slow one commits, then both arrive and neither is skipped.
        Assert.Empty(during.Games);
        Assert.Equal(
            new[] { slowGame.Id, fastGame.Id }.Order(),
            after.Games.Select(g => g.Id).Order());
    }
}
