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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new ChargeConfiguration());
        modelBuilder.ApplyConfiguration(new PaymentEventConfiguration());
        modelBuilder.ApplyConfiguration(new ReconciliationResultConfiguration());
    }
}
