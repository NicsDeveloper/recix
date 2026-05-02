using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Recix.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReconciliationConfidence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Novos campos em reconciliation_results ────────────────────────────

            migrationBuilder.AddColumn<string>(
                name: "confidence",
                table: "reconciliation_results",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "High");

            migrationBuilder.AddColumn<string>(
                name: "match_reason",
                table: "reconciliation_results",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "ExactExternalChargeId");

            migrationBuilder.AddColumn<string>(
                name: "matched_field",
                table: "reconciliation_results",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "requires_review",
                table: "reconciliation_results",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "reviewed_at",
                table: "reconciliation_results",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "reviewed_by_user_id",
                table: "reconciliation_results",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "review_decision",
                table: "reconciliation_results",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            // Aumentar maxLength do status para suportar os novos valores mais longos
            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "reconciliation_results",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(30)",
                oldMaxLength: 30);

            // ── Novo status em charges (PendingReview) ────────────────────────────
            // ChargeStatus é armazenado como string — não requer alter column,
            // apenas o novo valor "PendingReview" passa a ser válido na aplicação.

            // ── Índice para busca rápida de pendentes de revisão ──────────────────
            migrationBuilder.CreateIndex(
                name: "ix_reconciliation_results_pending_review",
                table: "reconciliation_results",
                columns: ["organization_id", "requires_review"]);

            // ── Retroativamente classificar registros existentes como High confidence
            // Todos os Matched existentes sem identificador são teoricamente Low confidence,
            // mas como não temos essa informação no histórico, deixamos como High para
            // não invalidar registros já auditados. Novos registros terão o campo correto.
            migrationBuilder.Sql(
                "UPDATE reconciliation_results SET requires_review = false WHERE requires_review IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_reconciliation_results_pending_review",
                table: "reconciliation_results");

            migrationBuilder.DropColumn(name: "confidence",          table: "reconciliation_results");
            migrationBuilder.DropColumn(name: "match_reason",        table: "reconciliation_results");
            migrationBuilder.DropColumn(name: "matched_field",       table: "reconciliation_results");
            migrationBuilder.DropColumn(name: "requires_review",     table: "reconciliation_results");
            migrationBuilder.DropColumn(name: "reviewed_at",         table: "reconciliation_results");
            migrationBuilder.DropColumn(name: "reviewed_by_user_id", table: "reconciliation_results");
            migrationBuilder.DropColumn(name: "review_decision",     table: "reconciliation_results");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "reconciliation_results",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40);
        }
    }
}
