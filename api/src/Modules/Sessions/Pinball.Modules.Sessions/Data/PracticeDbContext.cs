using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pinball.Modules.Sessions.Domain;
using Pinball.SharedKernel.Sync;

namespace Pinball.Modules.Sessions.Data;

public class PracticeDbContext(DbContextOptions<PracticeDbContext> options) : DbContext(options)
{
    public const string Schema = "practice";

    /// <summary>Shared by every synced table, so one cursor covers a whole pull.</summary>
    public const string SyncSequence = "sync_seq";

    public DbSet<User> Users => Set<User>();
    public DbSet<MachineInstance> MachineInstances => Set<MachineInstance>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<Ball> Balls => Set<Ball>();
    public DbSet<Note> Notes => Set<Note>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.HasDefaultSchema(Schema);
        model.HasSequence<long>(SyncSequence);

        model.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.AuthSubject).HasMaxLength(200);
            e.HasIndex(x => x.AuthSubject).IsUnique();
        });

        model.Entity<MachineInstance>(e =>
        {
            Synced(e);
            e.Property(x => x.OpdbMachineId).HasMaxLength(50);
            e.Property(x => x.OpdbAliasId).HasMaxLength(50);
            e.Property(x => x.LocationName).HasMaxLength(200);
            e.ToTable(t => t.HasCheckConstraint("ck_machine_instances_balls_per_game", "balls_per_game BETWEEN 1 AND 10"));
        });

        model.Entity<Session>(e =>
        {
            Synced(e);
            e.Property(x => x.CodeVersion).HasMaxLength(50);
            e.Property(x => x.Source).HasConversion<string>().HasMaxLength(20);
            e.HasOne<MachineInstance>().WithMany().HasForeignKey(x => x.MachineInstanceId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t => t.HasCheckConstraint("ck_sessions_balls_per_game", "balls_per_game BETWEEN 1 AND 10"));
        });

        model.Entity<Game>(e =>
        {
            Synced(e);
            e.HasOne<Session>().WithMany().HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_games_player_count", "player_count BETWEEN 1 AND 6");
                t.HasCheckConstraint("ck_games_final_score", "final_score >= 0");
            });
        });

        model.Entity<Ball>(e =>
        {
            Synced(e);
            e.Property(x => x.DrainReason).HasMaxLength(50);
            e.HasOne<Game>().WithMany().HasForeignKey(x => x.GameId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.GameId, x.Sequence }).IsUnique();
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_balls_ball_number", "ball_number >= 1");
                t.HasCheckConstraint("ck_balls_cumulative_score", "cumulative_score >= 0");
            });
        });

        model.Entity<Note>(e =>
        {
            Synced(e);
            e.Property(x => x.Body).HasMaxLength(4000);
            e.HasOne<Game>().WithMany().HasForeignKey(x => x.GameId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Ball>().WithMany().HasForeignKey(x => x.BallId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t => t.HasCheckConstraint("ck_notes_one_parent", "(game_id IS NULL) <> (ball_id IS NULL)"));
        });
    }

    private static void Synced<T>(EntityTypeBuilder<T> e) where T : SyncEntity
    {
        e.ConfigureSync();
        e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
