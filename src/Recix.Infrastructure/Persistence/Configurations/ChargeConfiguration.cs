using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Infrastructure.Persistence.Configurations;

public sealed class ChargeConfiguration : IEntityTypeConfiguration<Charge>
{
    public void Configure(EntityTypeBuilder<Charge> builder)
    {
        builder.ToTable("charges");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id");

        builder.Property(c => c.ReferenceId)
            .HasColumnName("reference_id")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(c => c.ExternalId)
            .HasColumnName("external_id")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(c => c.Amount)
            .HasColumnName("amount")
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(c => c.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(c => c.ExpiresAt)
            .HasColumnName("expires_at")
            .IsRequired();

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at");

        builder.HasIndex(c => c.ReferenceId)
            .IsUnique()
            .HasDatabaseName("ix_charges_reference_id");

        builder.HasIndex(c => c.ExternalId)
            .HasDatabaseName("ix_charges_external_id");

        builder.HasIndex(c => c.Status)
            .HasDatabaseName("ix_charges_status");
    }
}
