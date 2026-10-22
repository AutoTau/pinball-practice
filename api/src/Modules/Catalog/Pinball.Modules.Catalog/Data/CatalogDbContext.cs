using Microsoft.EntityFrameworkCore;
using Pinball.Modules.Catalog.Domain;

namespace Pinball.Modules.Catalog.Data;

public class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public const string Schema = "catalog";

    public DbSet<TitleGroup> TitleGroups => Set<TitleGroup>();
    public DbSet<Edition> Editions => Set<Edition>();
    public DbSet<EditionAlias> EditionAliases => Set<EditionAlias>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.HasDefaultSchema(Schema);

        model.Entity<TitleGroup>(e =>
        {
            e.HasKey(x => x.OpdbGroupId);
            e.Property(x => x.Name).HasMaxLength(200);
        });

        model.Entity<Edition>(e =>
        {
            e.HasKey(x => x.OpdbMachineId);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Variant).HasMaxLength(50);
            e.Property(x => x.Manufacturer).HasMaxLength(100);
            e.HasOne<TitleGroup>().WithMany().HasForeignKey(x => x.OpdbGroupId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<EditionAlias>(e =>
        {
            e.HasKey(x => x.OpdbAliasId);
            e.Property(x => x.Name).HasMaxLength(200);
            e.HasOne<Edition>().WithMany().HasForeignKey(x => x.OpdbMachineId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
