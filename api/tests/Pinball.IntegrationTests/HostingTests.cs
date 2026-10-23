using System.Net;

namespace Pinball.IntegrationTests;

/// <summary>Behavior a hosting platform relies on: health checks and request limits.</summary>
[Collection(PostgresCollection.Name)]
public class HostingTests(PostgresFixture db)
{
    [Fact]
    public async Task Health_is_ok_when_both_databases_answer()
    {
        await using var api = new SyncApi(db);

        var response = await api.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Health_fails_when_the_database_is_unreachable()
    {
        await using var api = new SyncApi(db)
        {
            Settings = { ["ConnectionStrings:Pinball"] = "Host=127.0.0.1;Port=1;Database=x;Username=x;Password=x;Timeout=2" },
        };

        var response = await api.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Sync_is_limited_per_user_with_a_retry_hint()
    {
        await using var api = new SyncApi(db) { Settings = { ["RateLimits:SyncPerMinute"] = "2" } };
        var alice = api.ClientFor($"user-{Guid.NewGuid():N}");
        var bob = api.ClientFor($"user-{Guid.NewGuid():N}");

        var allowed = new[] { await alice.GetAsync("/sync/pull"), await alice.GetAsync("/sync/pull") };
        var limited = await alice.GetAsync("/sync/pull");
        var otherUser = await bob.GetAsync("/sync/pull");

        Assert.All(allowed, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.True(int.Parse(limited.Headers.GetValues("Retry-After").Single()) > 0);
        Assert.Equal(HttpStatusCode.OK, otherUser.StatusCode);
    }
}
