using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Recix.Domain.Entities;

namespace Recix.Infrastructure.Persistence.Configurations;

public sealed class OrganizationMemberConfiguration : IEntityTypeConfiguration<OrganizationMember>
{
    public void Configure(EntityTypeBuilder<OrganizationMember> builder)
    {
        builder.ToTable("organization_members");

        builder.HasKey(m => new { m.OrganizationId, m.UserId });
        builder.Property(m => m.OrganizationId).HasColumnName("organization_id");
        builder.Property(m => m.UserId).HasColumnName("user_id");

        builder.Property(m => m.Role).HasColumnName("role").HasMaxLength(64).HasDefaultValue("Member");
        builder.Property(m => m.JoinedAt).HasColumnName("joined_at");

        builder.HasOne(m => m.User)
               .WithMany()
               .HasForeignKey(m => m.UserId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
