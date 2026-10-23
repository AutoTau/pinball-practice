using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Pinball.Modules.Catalog.Data.Migrations
{
    /// <inheritdoc />
    public partial class OpdbImport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "variant",
                schema: "catalog",
                table: "editions");

            migrationBuilder.AddColumn<string>(
                name: "short_name",
                schema: "catalog",
                table: "editions",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "retired_at",
                schema: "catalog",
                table: "title_groups",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "short_name",
                schema: "catalog",
                table: "title_groups",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "bobs_guide_url",
                schema: "catalog",
                table: "editions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "display",
                schema: "catalog",
                table: "editions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "physical_machine",
                schema: "catalog",
                table: "editions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "pinball_primer_url",
                schema: "catalog",
                table: "editions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pinball_rules_url",
                schema: "catalog",
                table: "editions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "retired_at",
                schema: "catalog",
                table: "editions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "type",
                schema: "catalog",
                table: "editions",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "physical_machine",
                schema: "catalog",
                table: "edition_aliases",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "retired_at",
                schema: "catalog",
                table: "edition_aliases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "short_name",
                schema: "catalog",
                table: "edition_aliases",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                schema: "catalog",
                table: "edition_aliases",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<short>(
                name: "year",
                schema: "catalog",
                table: "edition_aliases",
                type: "smallint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "opdb_imports",
                schema: "catalog",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    source_last_modified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    outcome = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    upserted = table.Column<int>(type: "integer", nullable: false),
                    retired = table.Column<int>(type: "integer", nullable: false),
                    error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_opdb_imports", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_opdb_imports_started_at",
                schema: "catalog",
                table: "opdb_imports",
                column: "started_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "opdb_imports",
                schema: "catalog");

            migrationBuilder.DropColumn(
                name: "retired_at",
                schema: "catalog",
                table: "title_groups");

            migrationBuilder.DropColumn(
                name: "short_name",
                schema: "catalog",
                table: "title_groups");

            migrationBuilder.DropColumn(
                name: "bobs_guide_url",
                schema: "catalog",
                table: "editions");

            migrationBuilder.DropColumn(
                name: "display",
                schema: "catalog",
                table: "editions");

            migrationBuilder.DropColumn(
                name: "physical_machine",
                schema: "catalog",
                table: "editions");

            migrationBuilder.DropColumn(
                name: "pinball_primer_url",
                schema: "catalog",
                table: "editions");

            migrationBuilder.DropColumn(
                name: "pinball_rules_url",
                schema: "catalog",
                table: "editions");

            migrationBuilder.DropColumn(
                name: "retired_at",
                schema: "catalog",
                table: "editions");

            migrationBuilder.DropColumn(
                name: "type",
                schema: "catalog",
                table: "editions");

            migrationBuilder.DropColumn(
                name: "physical_machine",
                schema: "catalog",
                table: "edition_aliases");

            migrationBuilder.DropColumn(
                name: "retired_at",
                schema: "catalog",
                table: "edition_aliases");

            migrationBuilder.DropColumn(
                name: "short_name",
                schema: "catalog",
                table: "edition_aliases");

            migrationBuilder.DropColumn(
                name: "updated_at",
                schema: "catalog",
                table: "edition_aliases");

            migrationBuilder.DropColumn(
                name: "year",
                schema: "catalog",
                table: "edition_aliases");

            migrationBuilder.DropColumn(
                name: "short_name",
                schema: "catalog",
                table: "editions");

            migrationBuilder.AddColumn<string>(
                name: "variant",
                schema: "catalog",
                table: "editions",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,");
        }
    }
}
