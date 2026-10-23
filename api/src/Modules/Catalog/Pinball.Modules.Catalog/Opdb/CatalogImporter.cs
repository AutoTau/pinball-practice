using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using NpgsqlTypes;
using Pinball.Modules.Catalog.Data;
using Pinball.Modules.Catalog.Domain;

namespace Pinball.Modules.Catalog.Opdb;

/// <summary>
/// Applies an OPDB export to the catalog: upserts every entry, retires the ones that left the export,
/// and rejects the whole file if the guards trip (decisions 30 and 31). One transaction per import.
/// </summary>
public sealed class CatalogImporter(
    CatalogDbContext db,
    IOpdbExportSource source,
    IOptions<OpdbImportOptions> options,
    TimeProvider clock,
    ILogger<CatalogImporter> logger)
{
    private static readonly JsonSerializerOptions SnakeCase = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    public async Task<OpdbImport> ImportAsync(CancellationToken ct = default)
    {
        var run = new OpdbImport { StartedAt = clock.GetUtcNow(), Outcome = OpdbImportOutcome.Running };
        db.OpdbImports.Add(run);
        await db.SaveChangesAsync(ct);

        try
        {
            var lastModified = await db.OpdbImports
                .Where(i => i.Outcome == OpdbImportOutcome.Imported)
                .OrderByDescending(i => i.StartedAt)
                .Select(i => i.SourceLastModified)
                .FirstOrDefaultAsync(ct);

            await using var download = await source.DownloadAsync(lastModified, ct);
            run.SourceLastModified = download.LastModified;

            if (download.NotModified)
                return await FinishAsync(run, OpdbImportOutcome.NotModified, ct);

            var snapshot = await OpdbExport.ParseAsync(download.Content!, ct);
            var (plan, rejection) = ImportGuard.Check(snapshot, await ActiveRowsAsync(ct), options.Value.Limits);

            if (rejection is not null)
            {
                logger.LogWarning("OPDB import rejected: {Reason}", rejection);
                run.Error = rejection;
                return await FinishAsync(run, OpdbImportOutcome.Rejected, ct);
            }

            await using (var tx = await db.Database.BeginTransactionAsync(ct))
            {
                run.Upserted = await UpsertAsync(snapshot, ct);
                run.Retired = await RetireAsync(snapshot, run.StartedAt, ct);
                await tx.CommitAsync(ct);
            }

            logger.LogInformation(
                "OPDB import: {Upserted} changed, {Retired} retired, {Invalid} invalid skipped, {Active} previously active",
                run.Upserted, run.Retired, snapshot.Invalid.Count, plan.Active);
            return await FinishAsync(run, OpdbImportOutcome.Imported, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "OPDB import failed");
            run.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
            db.ChangeTracker.Clear();
            db.OpdbImports.Attach(run).State = EntityState.Modified;
            return await FinishAsync(run, OpdbImportOutcome.Failed, ct);
        }
    }

    private async Task<OpdbImport> FinishAsync(OpdbImport run, OpdbImportOutcome outcome, CancellationToken ct)
    {
        run.Outcome = outcome;
        run.FinishedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return run;
    }

    private async Task<List<CatalogRow>> ActiveRowsAsync(CancellationToken ct)
    {
        var groups = await db.TitleGroups.Where(g => g.RetiredAt == null)
            .Select(g => new CatalogRow(g.OpdbGroupId, g.Name, null)).ToListAsync(ct);
        var editions = await db.Editions.Where(e => e.RetiredAt == null)
            .Select(e => new CatalogRow(e.OpdbMachineId, e.Name, e.OpdbGroupId)).ToListAsync(ct);
        var aliases = await db.EditionAliases.Where(a => a.RetiredAt == null)
            .Select(a => new CatalogRow(a.OpdbAliasId, a.Name, a.OpdbMachineId)).ToListAsync(ct);
        return [.. groups, .. editions, .. aliases];
    }

    // Each upsert writes only rows whose content changed; OPDB bumps updated_at daily on every entry,
    // so comparing timestamps would rewrite the whole catalog each time. A returning row is un-retired.
    private async Task<int> UpsertAsync(CatalogSnapshot s, CancellationToken ct) =>
        await ExecAsync("""
            INSERT INTO catalog.title_groups AS t (opdb_group_id, name, short_name, updated_at, retired_at)
            SELECT r.opdb_group_id, r.name, r.short_name, r.updated_at, NULL
            FROM jsonb_to_recordset(@rows) AS r(opdb_group_id text, name text, short_name text, updated_at timestamptz)
            ON CONFLICT (opdb_group_id) DO UPDATE
            SET name = excluded.name, short_name = excluded.short_name, updated_at = excluded.updated_at, retired_at = NULL
            WHERE (t.name, t.short_name, t.retired_at) IS DISTINCT FROM (excluded.name, excluded.short_name, NULL::timestamptz)
            """, s.Groups, ct)
        + await ExecAsync("""
            INSERT INTO catalog.editions AS t (opdb_machine_id, opdb_group_id, name, short_name, manufacturer, year, type, display,
                physical_machine, pinball_primer_url, pinball_rules_url, bobs_guide_url, image_small_url, image_medium_url,
                updated_at, retired_at)
            SELECT r.opdb_machine_id, r.opdb_group_id, r.name, r.short_name, r.manufacturer, r.year, r.type, r.display,
                r.physical_machine, r.pinball_primer_url, r.pinball_rules_url, r.bobs_guide_url, r.image_small_url,
                r.image_medium_url, r.updated_at, NULL
            FROM jsonb_to_recordset(@rows) AS r(opdb_machine_id text, opdb_group_id text, name text, short_name text,
                manufacturer text, year smallint, type text, display text, physical_machine boolean,
                pinball_primer_url text, pinball_rules_url text, bobs_guide_url text, image_small_url text,
                image_medium_url text, updated_at timestamptz)
            ON CONFLICT (opdb_machine_id) DO UPDATE
            SET opdb_group_id = excluded.opdb_group_id, name = excluded.name, short_name = excluded.short_name,
                manufacturer = excluded.manufacturer, year = excluded.year, type = excluded.type, display = excluded.display,
                physical_machine = excluded.physical_machine, pinball_primer_url = excluded.pinball_primer_url,
                pinball_rules_url = excluded.pinball_rules_url, bobs_guide_url = excluded.bobs_guide_url,
                image_small_url = excluded.image_small_url, image_medium_url = excluded.image_medium_url,
                updated_at = excluded.updated_at, retired_at = NULL
            WHERE (t.opdb_group_id, t.name, t.short_name, t.manufacturer, t.year, t.type, t.display, t.physical_machine,
                   t.pinball_primer_url, t.pinball_rules_url, t.bobs_guide_url, t.image_small_url, t.image_medium_url,
                   t.retired_at)
                IS DISTINCT FROM
                  (excluded.opdb_group_id, excluded.name, excluded.short_name, excluded.manufacturer, excluded.year,
                   excluded.type, excluded.display, excluded.physical_machine, excluded.pinball_primer_url,
                   excluded.pinball_rules_url, excluded.bobs_guide_url, excluded.image_small_url,
                   excluded.image_medium_url, NULL::timestamptz)
            """, s.Editions, ct)
        + await ExecAsync("""
            INSERT INTO catalog.edition_aliases AS t (opdb_alias_id, opdb_machine_id, name, short_name, year, physical_machine,
                image_small_url, image_medium_url, updated_at, retired_at)
            SELECT r.opdb_alias_id, r.opdb_machine_id, r.name, r.short_name, r.year, r.physical_machine, r.image_small_url,
                r.image_medium_url, r.updated_at, NULL
            FROM jsonb_to_recordset(@rows) AS r(opdb_alias_id text, opdb_machine_id text, name text, short_name text,
                year smallint, physical_machine boolean, image_small_url text, image_medium_url text, updated_at timestamptz)
            ON CONFLICT (opdb_alias_id) DO UPDATE
            SET opdb_machine_id = excluded.opdb_machine_id, name = excluded.name, short_name = excluded.short_name,
                year = excluded.year, physical_machine = excluded.physical_machine, image_small_url = excluded.image_small_url,
                image_medium_url = excluded.image_medium_url, updated_at = excluded.updated_at, retired_at = NULL
            WHERE (t.opdb_machine_id, t.name, t.short_name, t.year, t.physical_machine, t.image_small_url, t.image_medium_url,
                   t.retired_at)
                IS DISTINCT FROM
                  (excluded.opdb_machine_id, excluded.name, excluded.short_name, excluded.year, excluded.physical_machine,
                   excluded.image_small_url, excluded.image_medium_url, NULL::timestamptz)
            """, s.Aliases, ct);

    private async Task<int> RetireAsync(CatalogSnapshot s, DateTimeOffset now, CancellationToken ct)
    {
        var aliasIds = s.Aliases.Select(a => a.OpdbAliasId).ToArray();
        var machineIds = s.Editions.Select(e => e.OpdbMachineId).ToArray();
        var groupIds = s.Groups.Select(g => g.OpdbGroupId).ToArray();

        return await db.Database.ExecuteSqlAsync(
                $"UPDATE catalog.edition_aliases SET retired_at = {now} WHERE retired_at IS NULL AND NOT (opdb_alias_id = ANY({aliasIds}))", ct)
            + await db.Database.ExecuteSqlAsync(
                $"UPDATE catalog.editions SET retired_at = {now} WHERE retired_at IS NULL AND NOT (opdb_machine_id = ANY({machineIds}))", ct)
            + await db.Database.ExecuteSqlAsync(
                $"UPDATE catalog.title_groups SET retired_at = {now} WHERE retired_at IS NULL AND NOT (opdb_group_id = ANY({groupIds}))", ct);
    }

    private Task<int> ExecAsync<T>(string sql, IReadOnlyList<T> rows, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync(
            sql,
            [new NpgsqlParameter("rows", NpgsqlDbType.Jsonb) { Value = JsonSerializer.Serialize(rows, SnakeCase) }],
            ct);
}
