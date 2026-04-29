using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Recix.Domain.Entities;

namespace Recix.Infrastructure.Persistence.Configurations;

public sealed class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.ToTable("organizations");

        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id).HasColumnName("id");

        builder.Property(o => o.Name).HasColumnName("name").HasMaxLength(256).IsRequired();
        builder.Property(o => o.Slug).HasColumnName("slug").HasMaxLength(256).IsRequired();
        builder.HasIndex(o => o.Slug).IsUnique();

        builder.Property(o => o.Plan).HasColumnName("plan").HasMaxLength(64).HasDefaultValue("Free");
        builder.Property(o => o.CreatedAt).HasColumnName("created_at");

        builder.HasMany(o => o.Members)
               .WithOne(m => m.Organization)
               .HasForeignKey(m => m.OrganizationId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
