using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pinball.Modules.Sessions.Data.Migrations
{
    /// <inheritdoc />
    public partial class SyncXid : Migration
    {
        // ball_deltas selects b.*, so it pins the balls columns and is recreated around the change.
        private const string CreateBallDeltas = """
            CREATE VIEW practice.ball_deltas AS
            SELECT b.*,
                   b.cumulative_score
                     - COALESCE(LAG(b.cumulative_score) OVER (PARTITION BY b.game_id ORDER BY b.sequence), 0)
                     AS delta
            FROM practice.balls b
            WHERE b.deleted_at IS NULL;
            """;

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW practice.ball_deltas;");

            migrationBuilder.DropIndex(
                name: "ix_sessions_user_id_sync_seq",
                schema: "practice",
                table: "sessions");

            migrationBuilder.DropIndex(
                name: "ix_notes_user_id_sync_seq",
                schema: "practice",
                table: "notes");

            migrationBuilder.DropIndex(
                name: "ix_machine_instances_user_id_sync_seq",
                schema: "practice",
                table: "machine_instances");

            migrationBuilder.DropIndex(
                name: "ix_games_user_id_sync_seq",
                schema: "practice",
                table: "games");

            migrationBuilder.DropIndex(
                name: "ix_balls_user_id_sync_seq",
                schema: "practice",
                table: "balls");

            migrationBuilder.DropColumn(
                name: "sync_seq",
                schema: "practice",
                table: "sessions");

            migrationBuilder.DropColumn(
                name: "sync_seq",
                schema: "practice",
                table: "notes");

            migrationBuilder.DropColumn(
                name: "sync_seq",
                schema: "practice",
                table: "machine_instances");

            migrationBuilder.DropColumn(
                name: "sync_seq",
                schema: "practice",
                table: "games");

            migrationBuilder.DropColumn(
                name: "sync_seq",
                schema: "practice",
                table: "balls");

            migrationBuilder.DropSequence(
                name: "sync_seq",
                schema: "practice");

            migrationBuilder.AddColumn<ulong>(
                name: "sync_xid",
                schema: "practice",
                table: "sessions",
                type: "xid8",
                nullable: false,
                defaultValueSql: "pg_current_xact_id()");

            migrationBuilder.AddColumn<ulong>(
                name: "sync_xid",
                schema: "practice",
                table: "notes",
                type: "xid8",
                nullable: false,
                defaultValueSql: "pg_current_xact_id()");

            migrationBuilder.AddColumn<ulong>(
                name: "sync_xid",
                schema: "practice",
                table: "machine_instances",
                type: "xid8",
                nullable: false,
                defaultValueSql: "pg_current_xact_id()");

            migrationBuilder.AddColumn<ulong>(
                name: "sync_xid",
                schema: "practice",
                table: "games",
                type: "xid8",
                nullable: false,
                defaultValueSql: "pg_current_xact_id()");

            migrationBuilder.AddColumn<ulong>(
                name: "sync_xid",
                schema: "practice",
                table: "balls",
                type: "xid8",
                nullable: false,
                defaultValueSql: "pg_current_xact_id()");

            migrationBuilder.CreateIndex(
                name: "ix_sessions_user_id_sync_xid_id",
                schema: "practice",
                table: "sessions",
                columns: new[] { "user_id", "sync_xid", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_notes_user_id_sync_xid_id",
                schema: "practice",
                table: "notes",
                columns: new[] { "user_id", "sync_xid", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_machine_instances_user_id_sync_xid_id",
                schema: "practice",
                table: "machine_instances",
                columns: new[] { "user_id", "sync_xid", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_games_user_id_sync_xid_id",
                schema: "practice",
                table: "games",
                columns: new[] { "user_id", "sync_xid", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_balls_user_id_sync_xid_id",
                schema: "practice",
                table: "balls",
                columns: new[] { "user_id", "sync_xid", "id" });

            // The existing per-table triggers call this function, so replacing it switches them all (decision 32).
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION practice.assign_sync_seq() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    NEW.sync_xid := pg_current_xact_id();
                    RETURN NEW;
                END;
                $$;
                """);

            migrationBuilder.Sql(CreateBallDeltas);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW practice.ball_deltas;");

            migrationBuilder.DropIndex(
                name: "ix_sessions_user_id_sync_xid_id",
                schema: "practice",
                table: "sessions");

            migrationBuilder.DropIndex(
                name: "ix_notes_user_id_sync_xid_id",
                schema: "practice",
                table: "notes");

            migrationBuilder.DropIndex(
                name: "ix_machine_instances_user_id_sync_xid_id",
                schema: "practice",
                table: "machine_instances");

            migrationBuilder.DropIndex(
                name: "ix_games_user_id_sync_xid_id",
                schema: "practice",
                table: "games");

            migrationBuilder.DropIndex(
                name: "ix_balls_user_id_sync_xid_id",
                schema: "practice",
                table: "balls");

            migrationBuilder.DropColumn(
                name: "sync_xid",
                schema: "practice",
                table: "sessions");

            migrationBuilder.DropColumn(
                name: "sync_xid",
                schema: "practice",
                table: "notes");

            migrationBuilder.DropColumn(
                name: "sync_xid",
                schema: "practice",
                table: "machine_instances");

            migrationBuilder.DropColumn(
                name: "sync_xid",
                schema: "practice",
                table: "games");

            migrationBuilder.DropColumn(
                name: "sync_xid",
                schema: "practice",
                table: "balls");

            migrationBuilder.CreateSequence(
                name: "sync_seq",
                schema: "practice");

            migrationBuilder.AddColumn<long>(
                name: "sync_seq",
                schema: "practice",
                table: "sessions",
                type: "bigint",
                nullable: false,
                defaultValueSql: "nextval('practice.sync_seq')");

            migrationBuilder.AddColumn<long>(
                name: "sync_seq",
                schema: "practice",
                table: "notes",
                type: "bigint",
                nullable: false,
                defaultValueSql: "nextval('practice.sync_seq')");

            migrationBuilder.AddColumn<long>(
                name: "sync_seq",
                schema: "practice",
                table: "machine_instances",
                type: "bigint",
                nullable: false,
                defaultValueSql: "nextval('practice.sync_seq')");

            migrationBuilder.AddColumn<long>(
                name: "sync_seq",
                schema: "practice",
                table: "games",
                type: "bigint",
                nullable: false,
                defaultValueSql: "nextval('practice.sync_seq')");

            migrationBuilder.AddColumn<long>(
                name: "sync_seq",
                schema: "practice",
                table: "balls",
                type: "bigint",
                nullable: false,
                defaultValueSql: "nextval('practice.sync_seq')");

            migrationBuilder.CreateIndex(
                name: "ix_sessions_user_id_sync_seq",
                schema: "practice",
                table: "sessions",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_notes_user_id_sync_seq",
                schema: "practice",
                table: "notes",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_machine_instances_user_id_sync_seq",
                schema: "practice",
                table: "machine_instances",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_games_user_id_sync_seq",
                schema: "practice",
                table: "games",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_balls_user_id_sync_seq",
                schema: "practice",
                table: "balls",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION practice.assign_sync_seq() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    NEW.sync_seq := nextval('practice.sync_seq');
                    RETURN NEW;
                END;
                $$;
                """);

            migrationBuilder.Sql(CreateBallDeltas);
        }
    }
}
