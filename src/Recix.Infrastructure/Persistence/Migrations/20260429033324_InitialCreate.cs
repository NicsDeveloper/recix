using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recix.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "charges",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    reference_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    external_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_charges", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "payment_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    external_charge_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    reference_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    paid_amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    paid_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    provider = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    raw_payload = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    processed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "reconciliation_results",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    charge_id = table.Column<Guid>(type: "uuid", nullable: true),
                    payment_event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false),
                    expected_amount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    paid_amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliation_results", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_charges_external_id",
                table: "charges",
                column: "external_id");

            migrationBuilder.CreateIndex(
                name: "ix_charges_reference_id",
                table: "charges",
                column: "reference_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_charges_status",
                table: "charges",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_payment_events_event_id",
                table: "payment_events",
                column: "event_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payment_events_status",
                table: "payment_events",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_reconciliation_results_charge_id",
                table: "reconciliation_results",
                column: "charge_id");

            migrationBuilder.CreateIndex(
                name: "ix_reconciliation_results_payment_event_id",
                table: "reconciliation_results",
                column: "payment_event_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "charges");

            migrationBuilder.DropTable(
                name: "payment_events");

            migrationBuilder.DropTable(
                name: "reconciliation_results");
        }
    }
}
