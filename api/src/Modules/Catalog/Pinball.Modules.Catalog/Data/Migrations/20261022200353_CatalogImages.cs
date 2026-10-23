using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pinball.Modules.Catalog.Data.Migrations
{
    /// <inheritdoc />
    public partial class CatalogImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "image_medium_url",
                schema: "catalog",
                table: "editions",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "image_small_url",
                schema: "catalog",
                table: "editions",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "image_medium_url",
                schema: "catalog",
                table: "edition_aliases",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "image_small_url",
                schema: "catalog",
                table: "edition_aliases",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "image_medium_url",
                schema: "catalog",
                table: "editions");

            migrationBuilder.DropColumn(
                name: "image_small_url",
                schema: "catalog",
                table: "editions");

            migrationBuilder.DropColumn(
                name: "image_medium_url",
                schema: "catalog",
                table: "edition_aliases");

            migrationBuilder.DropColumn(
                name: "image_small_url",
                schema: "catalog",
                table: "edition_aliases");
        }
    }
}
