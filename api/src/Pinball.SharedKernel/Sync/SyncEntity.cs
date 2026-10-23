namespace Pinball.SharedKernel.Sync;

/// <summary>
/// Base for every user-owned record that syncs with the phone (decisions 5, 17, 32).
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

    /// <summary>
    /// ID of the transaction that last wrote the row, set by a database trigger. Pulls return rows whose
    /// transaction finished before every still-running one, so nothing can appear behind a cursor later.
    /// </summary>
    public ulong SyncXid { get; private set; }
}
