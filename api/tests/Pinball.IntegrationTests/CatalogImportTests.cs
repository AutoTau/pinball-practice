using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using Pinball.Modules.Catalog.Data;
using Pinball.Modules.Catalog.Domain;
using Pinball.Modules.Catalog.Opdb;
using Pinball.Modules.Catalog.Search;
using static Pinball.Modules.Catalog.Tests.OpdbSamples;

namespace Pinball.IntegrationTests;

// Catalog tests share one database, so they run in order inside one class.
[Collection(PostgresCollection.Name)]
public class CatalogImportTests(PostgresFixture db) : IAsyncLifetime
{
    private readonly FakeTimeProvider _clock = new(DateTimeOffset.Parse("2026-10-22T12:00:00Z"));

    public async Task InitializeAsync()
    {
        await using var ctx = db.CreateCatalog();
        await ctx.Database.ExecuteSqlRawAsync(
            "TRUNCATE catalog.edition_aliases, catalog.editions, catalog.title_groups, catalog.opdb_imports");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task First_import_inserts_everything()
    {
        var run = await ImportAsync(CatalogOf(100));

        Assert.Equal(OpdbImportOutcome.Imported, run.Outcome);
        Assert.Equal(205, run.Upserted);
        Assert.Equal(0, run.Retired);
    }

    [Fact]
    public async Task Reimporting_an_unchanged_file_writes_nothing()
    {
        await ImportAsync(CatalogOf(100));

        // OPDB bumps updatedAt on every entry daily; that alone must not count as a change.
        var bumped = CatalogOf(100).Select(e => e with { UpdatedAt = DateTimeOffset.Parse("2026-10-22T06:30:00Z") });
        var run = await ImportAsync(bumped);

        Assert.Equal(0, run.Upserted);
    }

    [Fact]
    public async Task Changes_are_updated_and_missing_entries_retired_then_restored()
    {
        await ImportAsync(CatalogOf(100));

        var changed = CatalogOf(100).Where(e => e.OpdbGroup != "Gt7").ToList();
        changed[1] = changed[1] with { PinballRulesUrl = "https://example.test/gz-pro" };
        var run = await ImportAsync(changed);

        Assert.Equal((1, 2), (run.Upserted, run.Retired));
        await using (var ctx = db.CreateCatalog())
        {
            Assert.Equal("https://example.test/gz-pro", (await ctx.Editions.FindAsync("GweeP-MW95j"))!.PinballRulesUrl);
            Assert.NotNull((await ctx.Editions.FindAsync("Gt7-Mm7"))!.RetiredAt);
        }

        var restored = await ImportAsync(CatalogOf(100));

        // Gt7's group and machine come back, and the Pro's rulesheet link reverts to none.
        Assert.Equal(3, restored.Upserted);
        await using var after = db.CreateCatalog();
        Assert.Null((await after.Editions.FindAsync("Gt7-Mm7"))!.RetiredAt);
    }

    [Fact]
    public async Task A_rejected_file_changes_nothing()
    {
        await ImportAsync(CatalogOf(100));

        var run = await ImportAsync(CatalogOf(50));

        Assert.Equal(OpdbImportOutcome.Rejected, run.Outcome);
        Assert.StartsWith("export has", run.Error);
        await using var ctx = db.CreateCatalog();
        Assert.Equal(0, await ctx.Editions.CountAsync(e => e.RetiredAt != null));
    }

    [Fact]
    public async Task An_unparseable_file_fails_and_changes_nothing()
    {
        await ImportAsync(CatalogOf(100));

        var run = await ImportRawAsync("{\"entries\": [ {\"opdbId\": ");

        Assert.Equal(OpdbImportOutcome.Failed, run.Outcome);
        await using var ctx = db.CreateCatalog();
        Assert.Equal(102, await ctx.Editions.CountAsync(e => e.RetiredAt == null));
    }

    [Fact]
    public async Task Sends_the_last_imports_Last_Modified_and_skips_an_unchanged_file()
    {
        var lastModified = DateTimeOffset.Parse("2026-10-22T06:30:13Z");
        await ImportAsync(CatalogOf(10), lastModified);

        var source = new FakeSource(null, null);
        var run = await RunAsync(source);

        Assert.Equal(lastModified, source.SentIfModifiedSince);
        Assert.Equal(OpdbImportOutcome.NotModified, run.Outcome);
    }

    [Fact]
    public async Task Search_finds_typos_short_names_and_aliases_but_not_umbrella_or_retired_entries()
    {
        await ImportAsync(CatalogOf(20).Where(e => e.OpdbGroup != "Gt3"));
        await using var ctx = db.CreateCatalog();
        var search = new CatalogSearch(ctx);

        var typo = await search.SearchAsync("godzila", 20, default);
        var shortName = await search.SearchAsync("gz", 20, default);
        var retired = await search.SearchAsync("Title 3", 20, default);

        Assert.Equal(
            ["Godzilla (LE)", "Godzilla (Premium)", "Godzilla (Pro)"],
            typo.Select(r => r.Name).Order());
        Assert.DoesNotContain(typo, r => r.Name == "Godzilla (Premium/LE)");
        Assert.All(typo, r => Assert.Equal("Godzilla", r.TitleGroupName));
        Assert.Equal(3, shortName.Count);
        Assert.DoesNotContain(retired, r => r.Name == "Title 3");
    }

    [Fact]
    public async Task Machines_list_is_pickable_entries_and_its_version_moves_only_on_real_changes()
    {
        var withArt = CatalogOf(100);
        withArt[2] = withArt[2] with // the Premium/LE machine: its aliases inherit its art
        {
            Images = [new OpdbImage("backglass", true, new OpdbImageUrls("https://img.test/gz-s.jpg", "https://img.test/gz-m.jpg", null))],
        };
        await ImportAsync(withArt);
        await using var ctx = db.CreateCatalog();
        var machines = new CatalogMachines(ctx);

        var first = await machines.GetAsync(default);
        await ImportAsync(withArt); // unchanged file
        var unchanged = await machines.CurrentVersionAsync(default);
        await ImportAsync(withArt.Where(e => e.OpdbGroup != "Gt2")); // retires Title 2, within the 2% cap
        var after = await machines.GetAsync(default);

        var le = first.Machines.Single(m => m.Name == "Godzilla (LE)");
        Assert.Equal(("GweeP-Ml9pZ", "GweeP-Ml9pZ-A9vXB", "GZ"), (le.OpdbMachineId, le.OpdbAliasId, le.ShortName));
        Assert.Equal(("https://img.test/gz-s.jpg", "https://img.test/gz-m.jpg"), (le.ImageSmallUrl, le.ImageMediumUrl));
        Assert.DoesNotContain(first.Machines, m => m.Name == "Godzilla (Premium/LE)");
        Assert.Equal(first.Version, unchanged);
        Assert.True(after.Version > first.Version);
        Assert.True(after.Machines.Single(m => m.Name == "Title 2").Retired);
    }

    private Task<OpdbImport> ImportAsync(IEnumerable<OpdbEntry> entries, DateTimeOffset? lastModified = null) =>
        ImportRawAsync(JsonSerializer.Serialize(new { entries }, JsonSerializerOptions.Web), lastModified);

    private Task<OpdbImport> ImportRawAsync(string json, DateTimeOffset? lastModified = null) =>
        RunAsync(new FakeSource(json, lastModified));

    private async Task<OpdbImport> RunAsync(FakeSource source)
    {
        _clock.Advance(TimeSpan.FromDays(1));
        await using var ctx = db.CreateCatalog();
        var importer = new CatalogImporter(
            ctx, source, Options.Create(new OpdbImportOptions()), _clock, NullLogger<CatalogImporter>.Instance);
        return await importer.ImportAsync();
    }

    private sealed class FakeSource(string? json, DateTimeOffset? lastModified) : IOpdbExportSource
    {
        public DateTimeOffset? SentIfModifiedSince { get; private set; }

        public Task<OpdbDownload> DownloadAsync(DateTimeOffset? ifModifiedSince, CancellationToken ct)
        {
            SentIfModifiedSince = ifModifiedSince;
            var content = json is null ? null : new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json));
            return Task.FromResult(new OpdbDownload(content, lastModified));
        }
    }
}
