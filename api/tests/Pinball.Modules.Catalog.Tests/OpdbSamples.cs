using Pinball.Modules.Catalog.Opdb;

namespace Pinball.Modules.Catalog.Tests;

/// <summary>Hand-written entries shaped like OPDB's v2 export.</summary>
public static class OpdbSamples
{
    public static OpdbEntry Group(string id, string name, string? shortName = null) => new()
    {
        OpdbId = id, OpdbGroup = id, EntryType = "machineGroup", Name = name, ShortName = shortName,
    };

    public static OpdbEntry Machine(string id, string name, bool physical = true, string? display = "lcd") => new()
    {
        OpdbId = id, OpdbGroup = id.Split('-')[0], OpdbMachine = id, EntryType = "machine", Name = name,
        PhysicalMachine = physical, Display = display, Year = 2021, Type = "ss",
        Manufacturer = new OpdbManufacturer("Stern"), UpdatedAt = DateTimeOffset.Parse("2026-10-21T06:30:24Z"),
    };

    public static OpdbEntry Alias(string id, string name) => new()
    {
        OpdbId = id, OpdbGroup = id.Split('-')[0], OpdbMachine = string.Join('-', id.Split('-')[..2]),
        EntryType = "alias", Name = name, PhysicalMachine = true, Year = 2021,
    };

    /// <summary>Godzilla as OPDB models it: Pro is its own machine, Premium and LE are aliases of one.</summary>
    public static List<OpdbEntry> Godzilla() =>
    [
        Group("GweeP", "Godzilla", "GZ"),
        Machine("GweeP-MW95j", "Godzilla (Pro)"),
        Machine("GweeP-Ml9pZ", "Godzilla (Premium/LE)", physical: false),
        Alias("GweeP-Ml9pZ-ARZoY", "Godzilla (Premium)"),
        Alias("GweeP-Ml9pZ-A9vXB", "Godzilla (LE)"),
    ];

    /// <summary>A catalog of <paramref name="titles"/> single-machine titles plus Godzilla.</summary>
    public static List<OpdbEntry> CatalogOf(int titles)
    {
        var entries = Godzilla();
        for (var i = 0; i < titles; i++)
        {
            entries.Add(Group($"Gt{i}", $"Title {i}"));
            entries.Add(Machine($"Gt{i}-Mm{i}", $"Title {i}", display: "dmd"));
        }

        return entries;
    }
}
