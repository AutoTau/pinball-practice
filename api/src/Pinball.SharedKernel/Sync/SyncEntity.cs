namespace Pinball.SharedKernel.Sync;

/// <summary>
/// Base for every user-owned record that syncs with the phone (decisions 5, 17, 20).
/// </summary>
public abstract class SyncEntity
{
    /// <summary>Generated on the device; the server never assigns it.</summary>
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Client time of the last edit; the newer value wins on conflict.</summary>
    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Soft delete. Synced rows are never hard-deleted.</summary>
    public DateTimeOffset? DeletedAt { get; set; }

    /// <summary>Server-assigned on every insert and update; clients pull rows above their cursor.</summary>
    public long SyncSeq { get; private set; }
}
