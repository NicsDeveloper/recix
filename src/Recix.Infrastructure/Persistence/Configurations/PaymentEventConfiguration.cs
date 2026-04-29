using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Recix.Domain.Entities;

namespace Recix.Infrastructure.Persistence.Configurations;

public sealed class PaymentEventConfiguration : IEntityTypeConfiguration<PaymentEvent>
{
    public void Configure(EntityTypeBuilder<PaymentEvent> builder)
    {
        builder.ToTable("payment_events");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id");

        builder.Property(e => e.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.HasIndex(e => e.OrganizationId)
            .HasDatabaseName("ix_payment_events_organization_id");

        builder.Property(e => e.EventId)
            .HasColumnName("event_id")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.ExternalChargeId)
            .HasColumnName("external_charge_id")
            .HasMaxLength(100);

        builder.Property(e => e.ReferenceId)
            .HasColumnName("reference_id")
            .HasMaxLength(50);

        builder.Property(e => e.PaidAmount)
            .HasColumnName("paid_amount")
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(e => e.PaidAt)
            .HasColumnName("paid_at")
            .IsRequired();

        builder.Property(e => e.Provider)
            .HasColumnName("provider")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.RawPayload)
            .HasColumnName("raw_payload")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.ProcessedAt)
            .HasColumnName("processed_at");

        // Idempotência: EventId único (technical-spec.md §Idempotência)
        builder.HasIndex(e => e.EventId)
            .IsUnique()
            .HasDatabaseName("ix_payment_events_event_id");

        builder.HasIndex(e => e.Status)
            .HasDatabaseName("ix_payment_events_status");
    }
}
