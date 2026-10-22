using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pinball.Modules.Catalog.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "catalog");

            migrationBuilder.CreateTable(
                name: "title_groups",
                schema: "catalog",
                columns: table => new
                {
                    opdb_group_id = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_title_groups", x => x.opdb_group_id);
                });

            migrationBuilder.CreateTable(
                name: "editions",
                schema: "catalog",
                columns: table => new
                {
                    opdb_machine_id = table.Column<string>(type: "text", nullable: false),
                    opdb_group_id = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    variant = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    manufacturer = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    year = table.Column<short>(type: "smallint", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_editions", x => x.opdb_machine_id);
                    table.ForeignKey(
                        name: "fk_editions_title_groups_opdb_group_id",
                        column: x => x.opdb_group_id,
                        principalSchema: "catalog",
                        principalTable: "title_groups",
                        principalColumn: "opdb_group_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "edition_aliases",
                schema: "catalog",
                columns: table => new
                {
                    opdb_alias_id = table.Column<string>(type: "text", nullable: false),
                    opdb_machine_id = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_edition_aliases", x => x.opdb_alias_id);
                    table.ForeignKey(
                        name: "fk_edition_aliases_editions_opdb_machine_id",
                        column: x => x.opdb_machine_id,
                        principalSchema: "catalog",
                        principalTable: "editions",
                        principalColumn: "opdb_machine_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_edition_aliases_opdb_machine_id",
                schema: "catalog",
                table: "edition_aliases",
                column: "opdb_machine_id");

            migrationBuilder.CreateIndex(
                name: "ix_editions_opdb_group_id",
                schema: "catalog",
                table: "editions",
                column: "opdb_group_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "edition_aliases",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "editions",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "title_groups",
                schema: "catalog");
        }
    }
}
