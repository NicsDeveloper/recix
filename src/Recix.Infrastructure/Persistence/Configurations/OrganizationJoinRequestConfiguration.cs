using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Infrastructure.Persistence.Configurations;

public sealed class OrganizationJoinRequestConfiguration : IEntityTypeConfiguration<OrganizationJoinRequest>
{
    public void Configure(EntityTypeBuilder<OrganizationJoinRequest> builder)
    {
        builder.ToTable("organization_join_requests");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");

        builder.Property(r => r.OrganizationId).HasColumnName("organization_id").IsRequired();
        builder.Property(r => r.UserId).HasColumnName("user_id").IsRequired();

        builder.Property(r => r.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .HasConversion<string>()
            .IsRequired()
            .HasDefaultValue(JoinRequestStatus.Pending);

        builder.Property(r => r.Message).HasColumnName("message").HasColumnType("text");
        builder.Property(r => r.RequestedAt).HasColumnName("requested_at").IsRequired();
        builder.Property(r => r.ReviewedAt).HasColumnName("reviewed_at");
        builder.Property(r => r.ReviewedByUserId).HasColumnName("reviewed_by_user_id");

        builder.HasOne(r => r.Organization)
               .WithMany()
               .HasForeignKey(r => r.OrganizationId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.User)
               .WithMany()
               .HasForeignKey(r => r.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => new { r.OrganizationId, r.Status })
               .HasDatabaseName("ix_join_requests_org_status");

        builder.HasIndex(r => r.UserId)
               .HasDatabaseName("ix_join_requests_user_id");
    }
}
