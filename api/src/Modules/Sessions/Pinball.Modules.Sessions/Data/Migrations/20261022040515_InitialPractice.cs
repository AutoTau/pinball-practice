using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pinball.Modules.Sessions.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialPractice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "practice");

            migrationBuilder.CreateSequence(
                name: "sync_seq",
                schema: "practice");

            migrationBuilder.CreateTable(
                name: "users",
                schema: "practice",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    auth_subject = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "machine_instances",
                schema: "practice",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    opdb_machine_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    opdb_alias_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    location_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    balls_per_game = table.Column<short>(type: "smallint", nullable: false),
                    ball_save_seconds = table.Column<short>(type: "smallint", nullable: true),
                    tilt_warnings = table.Column<short>(type: "smallint", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sync_seq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_machine_instances", x => x.id);
                    table.CheckConstraint("ck_machine_instances_balls_per_game", "balls_per_game BETWEEN 1 AND 10");
                    table.ForeignKey(
                        name: "fk_machine_instances_users_user_id",
                        column: x => x.user_id,
                        principalSchema: "practice",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sessions",
                schema: "practice",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    machine_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    balls_per_game = table.Column<short>(type: "smallint", nullable: false),
                    ball_save_seconds = table.Column<short>(type: "smallint", nullable: true),
                    tilt_warnings = table.Column<short>(type: "smallint", nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ended_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sync_seq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sessions", x => x.id);
                    table.CheckConstraint("ck_sessions_balls_per_game", "balls_per_game BETWEEN 1 AND 10");
                    table.ForeignKey(
                        name: "fk_sessions_machine_instances_machine_instance_id",
                        column: x => x.machine_instance_id,
                        principalSchema: "practice",
                        principalTable: "machine_instances",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_sessions_users_user_id",
                        column: x => x.user_id,
                        principalSchema: "practice",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "games",
                schema: "practice",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_number = table.Column<short>(type: "smallint", nullable: false),
                    player_count = table.Column<short>(type: "smallint", nullable: false),
                    final_score = table.Column<long>(type: "bigint", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sync_seq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_games", x => x.id);
                    table.CheckConstraint("ck_games_final_score", "final_score >= 0");
                    table.CheckConstraint("ck_games_player_count", "player_count BETWEEN 1 AND 6");
                    table.ForeignKey(
                        name: "fk_games_sessions_session_id",
                        column: x => x.session_id,
                        principalSchema: "practice",
                        principalTable: "sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_games_users_user_id",
                        column: x => x.user_id,
                        principalSchema: "practice",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "balls",
                schema: "practice",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence = table.Column<short>(type: "smallint", nullable: false),
                    ball_number = table.Column<short>(type: "smallint", nullable: false),
                    cumulative_score = table.Column<long>(type: "bigint", nullable: false),
                    drain_reason = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_extra_ball = table.Column<bool>(type: "boolean", nullable: false),
                    tilted = table.Column<bool>(type: "boolean", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sync_seq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_balls", x => x.id);
                    table.CheckConstraint("ck_balls_ball_number", "ball_number >= 1");
                    table.CheckConstraint("ck_balls_cumulative_score", "cumulative_score >= 0");
                    table.ForeignKey(
                        name: "fk_balls_games_game_id",
                        column: x => x.game_id,
                        principalSchema: "practice",
                        principalTable: "games",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_balls_users_user_id",
                        column: x => x.user_id,
                        principalSchema: "practice",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "notes",
                schema: "practice",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ball_id = table.Column<Guid>(type: "uuid", nullable: true),
                    body = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sync_seq = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notes", x => x.id);
                    table.CheckConstraint("ck_notes_one_parent", "(game_id IS NULL) <> (ball_id IS NULL)");
                    table.ForeignKey(
                        name: "fk_notes_balls_ball_id",
                        column: x => x.ball_id,
                        principalSchema: "practice",
                        principalTable: "balls",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_notes_games_game_id",
                        column: x => x.game_id,
                        principalSchema: "practice",
                        principalTable: "games",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_notes_users_user_id",
                        column: x => x.user_id,
                        principalSchema: "practice",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_balls_game_id_sequence",
                schema: "practice",
                table: "balls",
                columns: new[] { "game_id", "sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_balls_user_id_sync_seq",
                schema: "practice",
                table: "balls",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_games_session_id",
                schema: "practice",
                table: "games",
                column: "session_id");

            migrationBuilder.CreateIndex(
                name: "ix_games_user_id_sync_seq",
                schema: "practice",
                table: "games",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_machine_instances_user_id_sync_seq",
                schema: "practice",
                table: "machine_instances",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_notes_ball_id",
                schema: "practice",
                table: "notes",
                column: "ball_id");

            migrationBuilder.CreateIndex(
                name: "ix_notes_game_id",
                schema: "practice",
                table: "notes",
                column: "game_id");

            migrationBuilder.CreateIndex(
                name: "ix_notes_user_id_sync_seq",
                schema: "practice",
                table: "notes",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_sessions_machine_instance_id",
                schema: "practice",
                table: "sessions",
                column: "machine_instance_id");

            migrationBuilder.CreateIndex(
                name: "ix_sessions_user_id_sync_seq",
                schema: "practice",
                table: "sessions",
                columns: new[] { "user_id", "sync_seq" });

            migrationBuilder.CreateIndex(
                name: "ix_users_auth_subject",
                schema: "practice",
                table: "users",
                column: "auth_subject",
                unique: true);

            // Every insert and update takes the next sync_seq, so clients can pull
            // everything changed since their cursor (decision 20).
            migrationBuilder.Sql("""
                CREATE FUNCTION practice.assign_sync_seq() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    NEW.sync_seq := nextval('practice.sync_seq');
                    RETURN NEW;
                END;
                $$;
                """);

            foreach (var table in SyncedTables)
            {
                migrationBuilder.Sql($"""
                    CREATE TRIGGER {table}_assign_sync_seq
                    BEFORE INSERT OR UPDATE ON practice.{table}
                    FOR EACH ROW EXECUTE FUNCTION practice.assign_sync_seq();
                    """);
            }

            // Delta is derived, never stored (decision 22).
            migrationBuilder.Sql("""
                CREATE VIEW practice.ball_deltas AS
                SELECT b.*,
                       b.cumulative_score
                         - COALESCE(LAG(b.cumulative_score) OVER (PARTITION BY b.game_id ORDER BY b.sequence), 0)
                         AS delta
                FROM practice.balls b
                WHERE b.deleted_at IS NULL;
                """);
        }

        private static readonly string[] SyncedTables =
            ["machine_instances", "sessions", "games", "balls", "notes"];

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW practice.ball_deltas;");

            foreach (var table in SyncedTables)
            {
                migrationBuilder.Sql($"DROP TRIGGER {table}_assign_sync_seq ON practice.{table};");
            }

            migrationBuilder.Sql("DROP FUNCTION practice.assign_sync_seq();");

            migrationBuilder.DropTable(
                name: "notes",
                schema: "practice");

            migrationBuilder.DropTable(
                name: "balls",
                schema: "practice");

            migrationBuilder.DropTable(
                name: "games",
                schema: "practice");

            migrationBuilder.DropTable(
                name: "sessions",
                schema: "practice");

            migrationBuilder.DropTable(
                name: "machine_instances",
                schema: "practice");

            migrationBuilder.DropTable(
                name: "users",
                schema: "practice");

            migrationBuilder.DropSequence(
                name: "sync_seq",
                schema: "practice");
        }
    }
}
