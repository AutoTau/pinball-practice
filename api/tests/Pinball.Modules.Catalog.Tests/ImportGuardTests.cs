using Pinball.Modules.Catalog.Opdb;
using static Pinball.Modules.Catalog.Tests.OpdbSamples;

namespace Pinball.Modules.Catalog.Tests;

public class ImportGuardTests
{
    private static readonly ImportLimits Limits = new();

    // 100 titles + Godzilla = 205 rows.
    private static readonly List<CatalogRow> Active = ImportGuard.Rows(OpdbExport.Map(CatalogOf(100))).ToList();

    [Fact]
    public void Accepts_an_unchanged_catalog()
    {
        var (plan, rejection) = ImportGuard.Check(OpdbExport.Map(CatalogOf(100)), Active, Limits);

        Assert.Null(rejection);
        Assert.Equal(new ImportPlan(Retire: 0, Renamed: 0, Active: 205), plan);
    }

    [Fact]
    public void Accepts_any_first_import()
    {
        var (_, rejection) = ImportGuard.Check(OpdbExport.Map(Godzilla()), active: [], Limits);

        Assert.Null(rejection);
    }

    [Fact]
    public void Rejects_an_empty_export()
    {
        var (_, rejection) = ImportGuard.Check(OpdbExport.Map([]), Active, Limits);

        Assert.Equal("export has no entries", rejection);
    }

    [Fact]
    public void Rejects_a_truncated_export()
    {
        // Half the titles are gone, as if the download stopped partway.
        var (_, rejection) = ImportGuard.Check(OpdbExport.Map(CatalogOf(50)), Active, Limits);

        Assert.StartsWith("export has 105 valid entries", rejection);
    }

    [Fact]
    public void Accepts_retiring_within_the_cap_and_rejects_beyond_it()
    {
        // Removing one title retires 2 of 205 rows (1%); removing three retires 6 (2.9%).
        var (within, ok) = ImportGuard.Check(Without(CatalogOf(100), "Gt0"), Active, Limits);
        var (_, rejection) = ImportGuard.Check(Without(CatalogOf(100), "Gt0", "Gt1", "Gt2"), Active, Limits);

        Assert.Null(ok);
        Assert.Equal(2, within.Retire);
        Assert.Equal("would retire 6 of 205 active entries", rejection);
    }

    [Fact]
    public void Rejects_mass_renames()
    {
        var entries = CatalogOf(100).Select((e, i) => i % 10 == 0 ? e with { Name = e.Name + " ?" } : e).ToList();

        var (plan, rejection) = ImportGuard.Check(OpdbExport.Map(entries), Active, Limits);

        Assert.True(plan.Renamed > Active.Count * Limits.MaxRenameFraction);
        Assert.StartsWith("would rename or move", rejection);
    }

    [Fact]
    public void Rejects_a_file_with_too_many_invalid_entries()
    {
        var entries = CatalogOf(100).Select((e, i) => i % 20 == 0 ? e with { EntryType = "?" } : e).ToList();

        var (_, rejection) = ImportGuard.Check(OpdbExport.Map(entries), Active, Limits);

        Assert.Contains("entries invalid", rejection);
    }

    private static CatalogSnapshot Without(List<OpdbEntry> entries, params string[] groups) =>
        OpdbExport.Map(entries.Where(e => !groups.Contains(e.OpdbGroup)));
}
