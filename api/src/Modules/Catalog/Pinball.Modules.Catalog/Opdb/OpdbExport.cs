using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Pinball.Modules.Catalog.Domain;

namespace Pinball.Modules.Catalog.Opdb;

/// <summary>The subset of an OPDB v2 export entry the catalog uses.</summary>
public sealed record OpdbEntry
{
    public string? OpdbId { get; init; }
    public string? OpdbGroup { get; init; }
    public string? OpdbMachine { get; init; }
    public string? EntryType { get; init; }
    public string? Name { get; init; }
    public string? ShortName { get; init; }
    public int? Year { get; init; }
    public string? Type { get; init; }
    public string? Display { get; init; }
    public bool PhysicalMachine { get; init; }
    public string? PinballPrimerUrl { get; init; }
    public string? PinballRulesUrl { get; init; }
    public string? BobsGuideUrl { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
    public OpdbManufacturer? Manufacturer { get; init; }
    public IReadOnlyList<OpdbImage>? Images { get; init; }

    /// <summary>The art to show for this entry: its primary backglass, else any backglass, else any image.</summary>
    public OpdbImage? DisplayImage =>
        Images?.FirstOrDefault(i => i.Type == "backglass" && i.Primary)
        ?? Images?.FirstOrDefault(i => i.Type == "backglass")
        ?? Images?.FirstOrDefault();
}

public sealed record OpdbManufacturer(string? Name);

public sealed record OpdbImage(string? Type, bool Primary, OpdbImageUrls? Urls);

public sealed record OpdbImageUrls(string? Small, string? Medium, string? Large);

internal sealed record OpdbExportFile(IReadOnlyList<OpdbEntry>? Entries);

/// <summary>A parsed export, split into the catalog's three tables, plus entries that failed validation.</summary>
public sealed record CatalogSnapshot(
    IReadOnlyList<TitleGroup> Groups,
    IReadOnlyList<Edition> Editions,
    IReadOnlyList<EditionAlias> Aliases,
    IReadOnlyList<string> Invalid)
{
    public int Total => Groups.Count + Editions.Count + Aliases.Count;
}

public static partial class OpdbExport
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    // From OPDB's docs: group, optional machine, optional alias.
    [GeneratedRegex("^G([a-zA-Z0-9]+)(?:-M([a-zA-Z0-9]+)(?:-A([a-zA-Z0-9]+))?)?$")]
    private static partial Regex OpdbIdPattern();

    public static async Task<CatalogSnapshot> ParseAsync(Stream json, CancellationToken ct = default)
    {
        var file = await JsonSerializer.DeserializeAsync<OpdbExportFile>(json, Json, ct)
            ?? throw new InvalidDataException("OPDB export is empty.");

        return Map(file.Entries ?? throw new InvalidDataException("OPDB export has no 'entries' array."));
    }

    /// <summary>
    /// Splits entries by type. Invalid entries are collected rather than thrown so the importer can
    /// reject a file that has too many of them (decision 31).
    /// </summary>
    public static CatalogSnapshot Map(IEnumerable<OpdbEntry> entries)
    {
        var groups = new List<TitleGroup>();
        var editions = new List<Edition>();
        var aliases = new List<EditionAlias>();
        var invalid = new List<string>();

        foreach (var e in entries)
        {
            var problem = Validate(e);
            if (problem is not null)
            {
                invalid.Add($"{e.OpdbId ?? "(no id)"}: {problem}");
                continue;
            }

            var updatedAt = e.UpdatedAt ?? DateTimeOffset.UnixEpoch;
            switch (e.EntryType)
            {
                case "machineGroup":
                    groups.Add(new TitleGroup
                    {
                        OpdbGroupId = e.OpdbId!,
                        Name = e.Name!,
                        ShortName = e.ShortName,
                        UpdatedAt = updatedAt,
                    });
                    break;

                case "machine":
                    editions.Add(new Edition
                    {
                        OpdbMachineId = e.OpdbId!,
                        OpdbGroupId = e.OpdbGroup!,
                        Name = e.Name!,
                        ShortName = e.ShortName,
                        Manufacturer = e.Manufacturer?.Name,
                        Year = (short?)e.Year,
                        Type = e.Type,
                        Display = e.Display,
                        PhysicalMachine = e.PhysicalMachine,
                        PinballPrimerUrl = e.PinballPrimerUrl,
                        PinballRulesUrl = e.PinballRulesUrl,
                        BobsGuideUrl = e.BobsGuideUrl,
                        ImageSmallUrl = e.DisplayImage?.Urls?.Small,
                        ImageMediumUrl = e.DisplayImage?.Urls?.Medium,
                        UpdatedAt = updatedAt,
                    });
                    break;

                case "alias":
                    aliases.Add(new EditionAlias
                    {
                        OpdbAliasId = e.OpdbId!,
                        OpdbMachineId = e.OpdbMachine!,
                        Name = e.Name!,
                        ShortName = e.ShortName,
                        Year = (short?)e.Year,
                        PhysicalMachine = e.PhysicalMachine,
                        ImageSmallUrl = e.DisplayImage?.Urls?.Small,
                        ImageMediumUrl = e.DisplayImage?.Urls?.Medium,
                        UpdatedAt = updatedAt,
                    });
                    break;
            }
        }

        // Drop entries whose parent isn't in the file; inserting them would break foreign keys.
        var groupIds = groups.Select(g => g.OpdbGroupId).ToHashSet();
        foreach (var orphan in editions.Where(e => !groupIds.Contains(e.OpdbGroupId)))
            invalid.Add($"{orphan.OpdbMachineId}: group {orphan.OpdbGroupId} not in export");
        editions.RemoveAll(e => !groupIds.Contains(e.OpdbGroupId));

        var machineIds = editions.Select(e => e.OpdbMachineId).ToHashSet();
        foreach (var orphan in aliases.Where(a => !machineIds.Contains(a.OpdbMachineId)))
            invalid.Add($"{orphan.OpdbAliasId}: machine {orphan.OpdbMachineId} not in export");
        aliases.RemoveAll(a => !machineIds.Contains(a.OpdbMachineId));

        return new CatalogSnapshot(groups, editions, aliases, invalid);
    }

    private static string? Validate(OpdbEntry e)
    {
        if (string.IsNullOrWhiteSpace(e.OpdbId)) return "missing opdbId";

        var id = OpdbIdPattern().Match(e.OpdbId);
        if (!id.Success) return "malformed opdbId";
        if (string.IsNullOrWhiteSpace(e.Name)) return "missing name";
        if (e.Year is < 1800 or > 2200) return "implausible year";

        var hasMachine = id.Groups[2].Success;
        var hasAlias = id.Groups[3].Success;

        return e.EntryType switch
        {
            "machineGroup" when hasMachine => "group with a machine id",
            "machine" when !hasMachine || hasAlias => "machine id doesn't match type",
            "machine" when e.OpdbGroup is null || !e.OpdbId.StartsWith(e.OpdbGroup + "-", StringComparison.Ordinal) => "machine outside its group",
            "alias" when !hasAlias => "alias id doesn't match type",
            "alias" when e.OpdbMachine is null || !e.OpdbId.StartsWith(e.OpdbMachine + "-", StringComparison.Ordinal) => "alias outside its machine",
            "machineGroup" or "machine" or "alias" => null,
            _ => "unknown entryType",
        };
    }
}
