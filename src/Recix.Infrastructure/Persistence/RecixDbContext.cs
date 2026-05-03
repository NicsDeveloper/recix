using Microsoft.EntityFrameworkCore;
using Recix.Domain.Entities;
using Recix.Infrastructure.Persistence.Configurations;

namespace Recix.Infrastructure.Persistence;

public sealed class RecixDbContext : DbContext
{
    public RecixDbContext(DbContextOptions<RecixDbContext> options) : base(options) { }

    public DbSet<Charge> Charges => Set<Charge>();
    public DbSet<PaymentEvent> PaymentEvents => Set<PaymentEvent>();
    public DbSet<ReconciliationResult> ReconciliationResults => Set<ReconciliationResult>();
    public DbSet<PaymentAllocation> PaymentAllocations => Set<PaymentAllocation>();
    public DbSet<User>                      Users                    => Set<User>();
    public DbSet<Organization>              Organizations            => Set<Organization>();
    public DbSet<OrganizationMember>        OrganizationMembers      => Set<OrganizationMember>();
    public DbSet<OrganizationJoinRequest>   OrganizationJoinRequests => Set<OrganizationJoinRequest>();
    public DbSet<OrgAlertConfig>            OrgAlertConfigs          => Set<OrgAlertConfig>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new ChargeConfiguration());
        modelBuilder.ApplyConfiguration(new PaymentEventConfiguration());
        modelBuilder.ApplyConfiguration(new ReconciliationResultConfiguration());
        modelBuilder.ApplyConfiguration(new PaymentAllocationConfiguration());
        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new OrganizationConfiguration());
        modelBuilder.ApplyConfiguration(new OrganizationMemberConfiguration());
        modelBuilder.ApplyConfiguration(new OrganizationJoinRequestConfiguration());
        modelBuilder.ApplyConfiguration(new OrgAlertConfigConfiguration());
    }
}
