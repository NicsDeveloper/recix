using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Recix.Infrastructure.Persistence;

// Used only by dotnet-ef tooling at design time — not registered in DI.
public sealed class RecixDbContextFactory : IDesignTimeDbContextFactory<RecixDbContext>
{
    public RecixDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<RecixDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=recix;Username=recix;Password=recix123")
            .Options;

        return new RecixDbContext(options);
    }
}
