using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Recix.Domain.Entities;

namespace Recix.Infrastructure.Persistence.Configurations;

public sealed class OrgAlertConfigConfiguration : IEntityTypeConfiguration<OrgAlertConfig>
{
    public void Configure(EntityTypeBuilder<OrgAlertConfig> builder)
    {
        builder.ToTable("org_alert_configs");
        builder.HasKey(x => x.OrganizationId);

        builder.Property(x => x.OrganizationId)
               .HasColumnName("organization_id");

        builder.Property(x => x.WebhookUrl)
               .HasColumnName("webhook_url")
               .HasMaxLength(2048);

        builder.Property(x => x.NotifyAmountMismatch)
               .HasColumnName("notify_amount_mismatch")
               .HasDefaultValue(true);

        builder.Property(x => x.NotifyDuplicatePayment)
               .HasColumnName("notify_duplicate_payment")
               .HasDefaultValue(true);

        builder.Property(x => x.NotifyPaymentWithoutCharge)
               .HasColumnName("notify_payment_without_charge")
               .HasDefaultValue(true);

        builder.Property(x => x.NotifyExpiredChargePaid)
               .HasColumnName("notify_expired_charge_paid")
               .HasDefaultValue(true);

        builder.Property(x => x.UpdatedAt)
               .HasColumnName("updated_at");
    }
}
