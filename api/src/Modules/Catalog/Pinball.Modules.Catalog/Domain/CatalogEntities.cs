namespace Pinball.Modules.Catalog.Domain;

// Cached from OPDB's daily export. Keys are OPDB's own IDs, so they match other pinball apps (decision 6).
// Rows are never deleted: entries that leave the export get RetiredAt set (decision 30).

/// <summary>A title across all its editions, e.g. Godzilla.</summary>
public class TitleGroup
{
    public required string OpdbGroupId { get; set; }
    public required string Name { get; set; }
    public string? ShortName { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? RetiredAt { get; set; }
}

/// <summary>
/// An OPDB machine: one game, e.g. Godzilla (Pro) or Godzilla (Premium/LE). Editions that play
/// the same game share a machine and differ only by alias.
/// </summary>
public class Edition
{
    public required string OpdbMachineId { get; set; }
    public required string OpdbGroupId { get; set; }
    public required string Name { get; set; }
    public string? ShortName { get; set; }
    public string? Manufacturer { get; set; }
    public short? Year { get; set; }

    /// <summary>OPDB machine type: em, ss or me.</summary>
    public string? Type { get; set; }

    /// <summary>OPDB display type, e.g. dmd, lcd, alphanumeric; used to group the OCR evaluation set.</summary>
    public string? Display { get; set; }

    /// <summary>False for OPDB's umbrella entries, e.g. "Godzilla (Premium/LE)", whose aliases are the real machines.</summary>
    public bool PhysicalMachine { get; set; }

    // Rulesheet links: the app links out rather than hosting guides (decision 7).
    public string? PinballPrimerUrl { get; set; }
    public string? PinballRulesUrl { get; set; }
    public string? BobsGuideUrl { get; set; }

    // Backglass art hosted by OPDB, shown as thumbnails and headers (decision 40).
    public string? ImageSmallUrl { get; set; }
    public string? ImageMediumUrl { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? RetiredAt { get; set; }
}

/// <summary>A named variant of an edition, e.g. Godzilla (Premium) or Godzilla (LE).</summary>
public class EditionAlias
{
    public required string OpdbAliasId { get; set; }
    public required string OpdbMachineId { get; set; }
    public required string Name { get; set; }
    public string? ShortName { get; set; }
    public short? Year { get; set; }
    public bool PhysicalMachine { get; set; }
    public string? ImageSmallUrl { get; set; }
    public string? ImageMediumUrl { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? RetiredAt { get; set; }
}

/// <summary>One run of the OPDB import, kept for monitoring and for conditional downloads.</summary>
public class OpdbImport
{
    public long Id { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }

    /// <summary>The export's Last-Modified header, sent back as If-Modified-Since next time.</summary>
    public DateTimeOffset? SourceLastModified { get; set; }

    public OpdbImportOutcome Outcome { get; set; }
    public int Upserted { get; set; }
    public int Retired { get; set; }
    public string? Error { get; set; }
}

public enum OpdbImportOutcome
{
    Running,
    Imported,
    NotModified,
    Rejected,
    Failed,
}
