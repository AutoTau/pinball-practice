using Microsoft.EntityFrameworkCore;
using Pinball.Modules.Catalog.Domain;

namespace Pinball.Modules.Catalog.Data;

public class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public const string Schema = "catalog";

    public DbSet<TitleGroup> TitleGroups => Set<TitleGroup>();
    public DbSet<Edition> Editions => Set<Edition>();
    public DbSet<EditionAlias> EditionAliases => Set<EditionAlias>();
    public DbSet<OpdbImport> OpdbImports => Set<OpdbImport>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.HasDefaultSchema(Schema);
        model.HasPostgresExtension("pg_trgm");

        model.Entity<TitleGroup>(e =>
        {
            e.HasKey(x => x.OpdbGroupId);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.ShortName).HasMaxLength(50);
        });

        model.Entity<Edition>(e =>
        {
            e.HasKey(x => x.OpdbMachineId);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.ShortName).HasMaxLength(50);
            e.Property(x => x.Manufacturer).HasMaxLength(100);
            e.Property(x => x.Type).HasMaxLength(10);
            e.Property(x => x.Display).HasMaxLength(20);
            e.Property(x => x.PinballPrimerUrl).HasMaxLength(500);
            e.Property(x => x.PinballRulesUrl).HasMaxLength(500);
            e.Property(x => x.BobsGuideUrl).HasMaxLength(500);
            e.Property(x => x.ImageSmallUrl).HasMaxLength(300);
            e.Property(x => x.ImageMediumUrl).HasMaxLength(300);
            e.HasOne<TitleGroup>().WithMany().HasForeignKey(x => x.OpdbGroupId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<EditionAlias>(e =>
        {
            e.HasKey(x => x.OpdbAliasId);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.ImageSmallUrl).HasMaxLength(300);
            e.Property(x => x.ImageMediumUrl).HasMaxLength(300);
            e.Property(x => x.ShortName).HasMaxLength(50);
            e.HasOne<Edition>().WithMany().HasForeignKey(x => x.OpdbMachineId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<OpdbImport>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Outcome).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Error).HasMaxLength(2000);
            e.HasIndex(x => x.StartedAt);
        });
    }
}
