using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Pinball.SharedKernel.Sync;

public static class SyncEntityBuilderExtensions
{
    /// <summary>
    /// Applies the sync columns' key, generation and pull index. The value of
    /// <see cref="SyncEntity.SyncSeq"/> is set by a database trigger, which each
    /// module's migration creates.
    /// </summary>
    public static EntityTypeBuilder<T> ConfigureSync<T>(this EntityTypeBuilder<T> builder)
        where T : SyncEntity
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.SyncSeq).ValueGeneratedOnAddOrUpdate();
        builder.HasIndex(e => new { e.UserId, e.SyncSeq });
        return builder;
    }
}
