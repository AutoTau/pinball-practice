namespace Pinball.Modules.Catalog.Opdb;

/// <summary>An active catalog row as the guard needs to see it: its name and its parent's ID.</summary>
public sealed record CatalogRow(string Id, string Name, string? ParentId);

public sealed record ImportPlan(int Retire, int Renamed, int Active);

/// <summary>
/// Decides whether a parsed export is safe to apply (decision 31). Pure, so the limits are unit-tested
/// without a database.
/// </summary>
public static class ImportGuard
{
    public static (ImportPlan Plan, string? Rejection) Check(
        CatalogSnapshot snapshot, IReadOnlyCollection<CatalogRow> active, ImportLimits limits)
    {
        var incoming = Rows(snapshot).ToDictionary(r => r.Id);
        var retire = active.Count(r => !incoming.ContainsKey(r.Id));
        var renamed = active.Count(r =>
            incoming.TryGetValue(r.Id, out var next) && (next.Name != r.Name || next.ParentId != r.ParentId));
        var plan = new ImportPlan(retire, renamed, active.Count);

        var seen = snapshot.Total + snapshot.Invalid.Count;
        if (seen == 0)
            return (plan, "export has no entries");

        if (Fraction(snapshot.Invalid.Count, seen) > limits.MaxInvalidFraction)
            return (plan, $"{snapshot.Invalid.Count} of {seen} entries invalid, e.g. {snapshot.Invalid[0]}");

        // A first import has nothing to compare against.
        if (active.Count == 0)
            return (plan, null);

        if (snapshot.Total < active.Count * limits.MinSizeRatio)
            return (plan, $"export has {snapshot.Total} valid entries, below {limits.MinSizeRatio:P0} of the {active.Count} active");

        if (Fraction(retire, active.Count) > limits.MaxRetireFraction)
            return (plan, $"would retire {retire} of {active.Count} active entries");

        if (Fraction(renamed, active.Count) > limits.MaxRenameFraction)
            return (plan, $"would rename or move {renamed} of {active.Count} active entries");

        return (plan, null);
    }

    public static IEnumerable<CatalogRow> Rows(CatalogSnapshot s) =>
        s.Groups.Select(g => new CatalogRow(g.OpdbGroupId, g.Name, null))
            .Concat(s.Editions.Select(e => new CatalogRow(e.OpdbMachineId, e.Name, e.OpdbGroupId)))
            .Concat(s.Aliases.Select(a => new CatalogRow(a.OpdbAliasId, a.Name, a.OpdbMachineId)));

    private static double Fraction(int part, int whole) => whole == 0 ? 0 : (double)part / whole;
}
