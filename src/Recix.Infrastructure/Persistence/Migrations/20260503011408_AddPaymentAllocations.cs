using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recix.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentAllocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "payment_allocations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    charge_id = table.Column<Guid>(type: "uuid", nullable: false),
                    payment_event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    recognition = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    voided_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_allocations", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_payment_allocations_charge_id",
                table: "payment_allocations",
                column: "charge_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_allocations_org_charge",
                table: "payment_allocations",
                columns: new[] { "organization_id", "charge_id" });

            migrationBuilder.Sql(
                """
                INSERT INTO payment_allocations (id, organization_id, charge_id, payment_event_id, amount, recognition, created_at, voided_at)
                SELECT gen_random_uuid(), r.organization_id, r.charge_id, r.payment_event_id, r.paid_amount, 'Recognized', r.created_at, NULL
                FROM reconciliation_results r
                WHERE r.payment_event_id <> '00000000-0000-0000-0000-000000000000'
                  AND r.charge_id IS NOT NULL
                  AND (
                    r.status = 'Matched'
                    OR r.status = 'PartialPayment'
                    OR (r.status = 'MatchedLowConfidence' AND r.review_decision = 'Confirmed')
                    OR (r.status = 'AmountMismatch' AND r.expected_amount IS NOT NULL AND r.paid_amount < r.expected_amount)
                  );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payment_allocations");
        }
    }
}
