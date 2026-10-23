using Microsoft.EntityFrameworkCore;
using Pinball.Modules.Catalog.Data;

namespace Pinball.Modules.Catalog.Search;

/// <summary>A machine a player can pick: a physical OPDB machine or alias that hasn't been retired.</summary>
public sealed class CatalogSearchResult
{
    public required string OpdbId { get; init; }
    public required string Name { get; init; }
    public string? ShortName { get; init; }
    public required string TitleGroupId { get; init; }
    public required string TitleGroupName { get; init; }
    public string? Manufacturer { get; init; }
    public short? Year { get; init; }
    public string? Display { get; init; }
    public bool IsAlias { get; init; }
    public string? PinballPrimerUrl { get; init; }
    public string? PinballRulesUrl { get; init; }
    public string? BobsGuideUrl { get; init; }
    public double Score { get; init; }
}

/// <summary>Trigram search over machine names, so typos still match (decision 28).</summary>
public sealed class CatalogSearch(CatalogDbContext db)
{
    public const int MinQueryLength = 2;
    public const int MaxQueryLength = 100;
    public const int MaxLimit = 50;

    // Low enough for "godzila" to find "Godzilla (Pro)", high enough to drop unrelated titles.
    private const double MinScore = 0.35;

    public Task<List<CatalogSearchResult>> SearchAsync(string query, int limit, CancellationToken ct)
    {
        var q = query.Trim();
        var like = "%" + q.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_") + "%";

        // Aliases inherit display and rulesheets from their machine. The catalog is a few thousand rows,
        // so this scans rather than using a trigram index.
        return db.Database.SqlQuery<CatalogSearchResult>($"""
            WITH candidates AS (
                SELECT e.opdb_machine_id AS opdb_id, e.opdb_group_id, e.name, e.short_name, e.manufacturer, e.year,
                       e.display, false AS is_alias, e.pinball_primer_url, e.pinball_rules_url, e.bobs_guide_url
                FROM catalog.editions e
                WHERE e.physical_machine AND e.retired_at IS NULL
                UNION ALL
                SELECT a.opdb_alias_id, e.opdb_group_id, a.name, COALESCE(a.short_name, e.short_name), e.manufacturer,
                       COALESCE(a.year, e.year), e.display, true, e.pinball_primer_url, e.pinball_rules_url, e.bobs_guide_url
                FROM catalog.edition_aliases a
                JOIN catalog.editions e ON e.opdb_machine_id = a.opdb_machine_id
                WHERE a.physical_machine AND a.retired_at IS NULL AND e.retired_at IS NULL
            ),
            scored AS (
                SELECT c.opdb_id, c.name, COALESCE(c.short_name, g.short_name) AS short_name,
                       g.opdb_group_id, g.name AS group_name, c.manufacturer, c.year, c.display, c.is_alias,
                       c.pinball_primer_url, c.pinball_rules_url, c.bobs_guide_url,
                       GREATEST(
                           word_similarity(lower({q}), lower(c.name)),
                           CASE WHEN lower(COALESCE(c.short_name, g.short_name)) = lower({q}) THEN 1.0 ELSE 0 END,
                           CASE WHEN c.name ILIKE {like} THEN 0.9 ELSE 0 END
                       )::double precision AS score
                FROM candidates c
                JOIN catalog.title_groups g ON g.opdb_group_id = c.opdb_group_id
            )
            -- Column names follow the context's snake_case convention, which SqlQuery applies to the result type.
            SELECT s.opdb_id, s.name, s.short_name, s.opdb_group_id AS title_group_id, s.group_name AS title_group_name,
                   s.manufacturer, s.year, s.display, s.is_alias, s.pinball_primer_url, s.pinball_rules_url,
                   s.bobs_guide_url, s.score
            FROM scored s
            WHERE s.score >= {MinScore}
            ORDER BY s.score DESC, s.year DESC NULLS LAST, s.name
            LIMIT {Math.Clamp(limit, 1, MaxLimit)}
            """).ToListAsync(ct);
    }
}
