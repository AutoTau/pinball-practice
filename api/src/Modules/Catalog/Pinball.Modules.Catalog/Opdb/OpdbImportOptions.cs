namespace Pinball.Modules.Catalog.Opdb;

/// <summary>Bound from the <c>Catalog:Opdb</c> configuration section.</summary>
public sealed class OpdbImportOptions
{
    public const string Section = "Catalog:Opdb";

    public bool Enabled { get; set; } = true;
    public Uri ExportUrl { get; set; } = new("https://mp-data.sfo3.cdn.digitaloceanspaces.com/opdb-v2.json");

    /// <summary>How old the last import may be before a new one runs. OPDB publishes once a day.</summary>
    public TimeSpan RefreshInterval { get; set; } = TimeSpan.FromHours(24);

    /// <summary>How often the worker wakes to check whether an import is due.</summary>
    public TimeSpan CheckInterval { get; set; } = TimeSpan.FromHours(1);

    public ImportLimits Limits { get; set; } = new();
}

/// <summary>Bad-file guards (decision 31). Any breach rejects the whole import.</summary>
public sealed class ImportLimits
{
    /// <summary>Largest share of entries that may fail validation.</summary>
    public double MaxInvalidFraction { get; set; } = 0.01;

    /// <summary>The file must hold at least this share of the current active catalog.</summary>
    public double MinSizeRatio { get; set; } = 0.90;

    /// <summary>Largest share of active rows one import may retire.</summary>
    public double MaxRetireFraction { get; set; } = 0.02;

    /// <summary>Largest share of existing rows one import may rename or move to another parent.</summary>
    public double MaxRenameFraction { get; set; } = 0.05;
}
