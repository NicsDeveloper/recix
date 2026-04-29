using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recix.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPixCopiaECola : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "pix_copia_e_cola",
                table: "charges",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "pix_copia_e_cola",
                table: "charges");
        }
    }
}
