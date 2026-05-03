using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Infrastructure.Persistence.Configurations;

public sealed class PaymentAllocationConfiguration : IEntityTypeConfiguration<PaymentAllocation>
{
    public void Configure(EntityTypeBuilder<PaymentAllocation> builder)
    {
        builder.ToTable("payment_allocations");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasColumnName("id");

        builder.Property(a => a.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(a => a.ChargeId)
            .HasColumnName("charge_id")
            .IsRequired();

        builder.Property(a => a.PaymentEventId)
            .HasColumnName("payment_event_id")
            .IsRequired();

        builder.Property(a => a.Amount)
            .HasColumnName("amount")
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(a => a.Recognition)
            .HasColumnName("recognition")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(a => a.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(a => a.VoidedAt)
            .HasColumnName("voided_at");

        builder.HasIndex(a => a.ChargeId)
            .HasDatabaseName("ix_payment_allocations_charge_id");

        builder.HasIndex(a => new { a.OrganizationId, a.ChargeId })
            .HasDatabaseName("ix_payment_allocations_org_charge");
    }
}
