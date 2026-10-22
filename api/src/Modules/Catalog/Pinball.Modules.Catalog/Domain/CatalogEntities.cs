namespace Pinball.Modules.Catalog.Domain;

// Cached from OPDB. Keys are OPDB's own IDs, so they match other pinball apps (decision 6).

/// <summary>A title across all its editions, e.g. Godzilla.</summary>
public class TitleGroup
{
    public required string OpdbGroupId { get; set; }
    public required string Name { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>A specific edition, e.g. Godzilla (Premium).</summary>
public class Edition
{
    public required string OpdbMachineId { get; set; }
    public required string OpdbGroupId { get; set; }
    public required string Name { get; set; }

    /// <summary>Pro, Premium, LE, or null for single-edition titles.</summary>
    public string? Variant { get; set; }

    public string? Manufacturer { get; set; }
    public short? Year { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>An alternate name OPDB lists for an edition.</summary>
public class EditionAlias
{
    public required string OpdbAliasId { get; set; }
    public required string OpdbMachineId { get; set; }
    public required string Name { get; set; }
}
