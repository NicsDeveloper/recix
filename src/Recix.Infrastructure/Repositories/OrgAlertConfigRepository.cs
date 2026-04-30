using Microsoft.EntityFrameworkCore;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Repositories;

public sealed class OrgAlertConfigRepository(RecixDbContext db) : IOrgAlertConfigRepository
{
    public Task<OrgAlertConfig?> GetByOrgIdAsync(Guid orgId, CancellationToken ct = default)
        => db.OrgAlertConfigs.FirstOrDefaultAsync(x => x.OrganizationId == orgId, ct);

    public async Task UpsertAsync(OrgAlertConfig config, CancellationToken ct = default)
    {
        var existing = await db.OrgAlertConfigs
            .FirstOrDefaultAsync(x => x.OrganizationId == config.OrganizationId, ct);

        if (existing is null)
            db.OrgAlertConfigs.Add(config);
        else
            db.Entry(existing).CurrentValues.SetValues(config);

        await db.SaveChangesAsync(ct);
    }
}
