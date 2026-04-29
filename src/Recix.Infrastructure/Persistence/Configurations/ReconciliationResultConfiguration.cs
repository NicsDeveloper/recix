using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Recix.Domain.Entities;

namespace Recix.Infrastructure.Persistence.Configurations;

public sealed class ReconciliationResultConfiguration : IEntityTypeConfiguration<ReconciliationResult>
{
    public void Configure(EntityTypeBuilder<ReconciliationResult> builder)
    {
        builder.ToTable("reconciliation_results");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");

        builder.Property(r => r.ChargeId)
            .HasColumnName("charge_id");

        builder.Property(r => r.PaymentEventId)
            .HasColumnName("payment_event_id")
            .IsRequired();

        builder.Property(r => r.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
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

        builder.HasIndex(r => r.ChargeId)
            .HasDatabaseName("ix_reconciliation_results_charge_id");

        builder.HasIndex(r => r.PaymentEventId)
            .HasDatabaseName("ix_reconciliation_results_payment_event_id");
    }
}
