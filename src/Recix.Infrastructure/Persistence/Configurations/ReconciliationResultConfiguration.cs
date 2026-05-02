using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Infrastructure.Persistence.Configurations;

public sealed class ReconciliationResultConfiguration : IEntityTypeConfiguration<ReconciliationResult>
{
    public void Configure(EntityTypeBuilder<ReconciliationResult> builder)
    {
        builder.ToTable("reconciliation_results");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");

        builder.Property(r => r.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.HasIndex(r => r.OrganizationId)
            .HasDatabaseName("ix_reconciliation_results_organization_id");

        builder.Property(r => r.ChargeId)
            .HasColumnName("charge_id");

        builder.Property(r => r.PaymentEventId)
            .HasColumnName("payment_event_id")
            .IsRequired();

        builder.Property(r => r.Status)
            .HasColumnName("status")
            .HasMaxLength(40)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(r => r.Reason)
            .HasColumnName("reason")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(r => r.ExpectedAmount)
            .HasColumnName("expected_amount")
            .HasColumnType("numeric(18,2)");

        builder.Property(r => r.PaidAmount)
            .HasColumnName("paid_amount")
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(r => r.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // ── Campos de confiança e matching ────────────────────────────────────────

        builder.Property(r => r.Confidence)
            .HasColumnName("confidence")
            .HasMaxLength(10)
            .HasConversion<string>()
            .IsRequired()
            .HasDefaultValue(ConfidenceLevel.High);

        builder.Property(r => r.MatchReason)
            .HasColumnName("match_reason")
            .HasMaxLength(40)
            .HasConversion<string>()
            .IsRequired()
            .HasDefaultValue(MatchReason.ExactExternalChargeId);

        builder.Property(r => r.MatchedField)
            .HasColumnName("matched_field")
            .HasMaxLength(50);

        builder.Property(r => r.RequiresReview)
            .HasColumnName("requires_review")
            .IsRequired()
            .HasDefaultValue(false);

        // ── Auditoria de revisão ──────────────────────────────────────────────────

        builder.Property(r => r.ReviewedAt)
            .HasColumnName("reviewed_at");

        builder.Property(r => r.ReviewedByUserId)
            .HasColumnName("reviewed_by_user_id");

        builder.Property(r => r.ReviewDecision)
            .HasColumnName("review_decision")
            .HasMaxLength(20);

        // ── Índices ───────────────────────────────────────────────────────────────

        builder.HasIndex(r => r.ChargeId)
            .HasDatabaseName("ix_reconciliation_results_charge_id");

        builder.HasIndex(r => r.PaymentEventId)
            .HasDatabaseName("ix_reconciliation_results_payment_event_id");

        builder.HasIndex(r => new { r.OrganizationId, r.RequiresReview })
            .HasDatabaseName("ix_reconciliation_results_pending_review");
    }
}
