using Microsoft.EntityFrameworkCore;
using Pinball.Modules.Catalog.Data;
using Pinball.Modules.Catalog.Domain;

namespace Pinball.Modules.Catalog.Search;

/// <summary>A pickable machine as the phone stores it: a physical OPDB machine or alias.</summary>
public sealed class CatalogMachine
{
    /// <summary>The alias ID for aliases, otherwise the machine ID.</summary>
    public required string OpdbId { get; init; }

    /// <summary>The machine this entry belongs to; equals <see cref="OpdbId"/> unless it's an alias.</summary>
    public required string OpdbMachineId { get; init; }

    public string? OpdbAliasId { get; init; }
    public required string Name { get; init; }
    public string? ShortName { get; init; }
    public required string TitleGroupName { get; init; }
    public string? Manufacturer { get; init; }
    public short? Year { get; init; }
    public string? Display { get; init; }

    /// <summary>Kept so old sessions still show a name; the phone hides these from search.</summary>
    public bool Retired { get; init; }

    public string? PinballPrimerUrl { get; init; }
    public string? PinballRulesUrl { get; init; }
    public string? BobsGuideUrl { get; init; }

    /// <summary>Backglass art from OPDB: ~250 px for lists, ~640 px for headers. Null when OPDB has none.</summary>
    public string? ImageSmallUrl { get; init; }
    public string? ImageMediumUrl { get; init; }
}

public sealed record CatalogMachinesResponse(long Version, IReadOnlyList<CatalogMachine> Machines);

/// <summary>
/// The whole pickable catalog for the phone's offline copy (decision 29). It's a few hundred KB, so the
/// phone downloads all of it and the version, the last import that changed anything, drives caching (decision 37).
/// </summary>
public sealed class CatalogMachines(CatalogDbContext db)
{
    /// <summary>ID of the latest import that wrote changes; 0 before the first import.</summary>
    public async Task<long> CurrentVersionAsync(CancellationToken ct) =>
        await db.OpdbImports
            .Where(i => i.Outcome == OpdbImportOutcome.Imported && (i.Upserted > 0 || i.Retired > 0))
            .MaxAsync(i => (long?)i.Id, ct) ?? 0;

    public async Task<CatalogMachinesResponse> GetAsync(CancellationToken ct)
    {
        var version = await CurrentVersionAsync(ct);

        // Column names follow the context's snake_case convention, which SqlQuery applies to the result type.
        var machines = await db.Database.SqlQuery<CatalogMachine>($"""
            SELECT e.opdb_machine_id AS opdb_id, e.opdb_machine_id, NULL AS opdb_alias_id, e.name,
                   COALESCE(e.short_name, g.short_name) AS short_name, g.name AS title_group_name,
                   e.manufacturer, e.year, e.display, (e.retired_at IS NOT NULL) AS retired,
                   e.pinball_primer_url, e.pinball_rules_url, e.bobs_guide_url, e.image_small_url, e.image_medium_url
            FROM catalog.editions e
            JOIN catalog.title_groups g ON g.opdb_group_id = e.opdb_group_id
            WHERE e.physical_machine
            UNION ALL
            SELECT a.opdb_alias_id, e.opdb_machine_id, a.opdb_alias_id, a.name,
                   COALESCE(a.short_name, e.short_name, g.short_name), g.name,
                   e.manufacturer, COALESCE(a.year, e.year), e.display,
                   (a.retired_at IS NOT NULL OR e.retired_at IS NOT NULL),
                   e.pinball_primer_url, e.pinball_rules_url, e.bobs_guide_url,
                   COALESCE(a.image_small_url, e.image_small_url), COALESCE(a.image_medium_url, e.image_medium_url)
            FROM catalog.edition_aliases a
            JOIN catalog.editions e ON e.opdb_machine_id = a.opdb_machine_id
            JOIN catalog.title_groups g ON g.opdb_group_id = e.opdb_group_id
            WHERE a.physical_machine
            ORDER BY name, opdb_id
            """).ToListAsync(ct);

        return new CatalogMachinesResponse(version, machines);
    }
}
