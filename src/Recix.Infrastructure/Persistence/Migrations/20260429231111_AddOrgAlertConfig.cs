using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recix.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrgAlertConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "org_alert_configs",
                columns: table => new
                {
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    webhook_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    notify_amount_mismatch = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    notify_duplicate_payment = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    notify_payment_without_charge = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    notify_expired_charge_paid = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_org_alert_configs", x => x.organization_id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "org_alert_configs");
        }
    }
}
