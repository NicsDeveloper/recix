using Microsoft.EntityFrameworkCore;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Repositories;

public sealed class ChargeRepository(RecixDbContext db, ICurrentOrganization currentOrg) : IChargeRepository
{
    // Retorna apenas as charges da org atual (ou todas se contexto de sistema)
    private IQueryable<Charge> OrgQuery() =>
        currentOrg.OrganizationId.HasValue
            ? db.Charges.Where(c => c.OrganizationId == currentOrg.OrganizationId.Value)
            : db.Charges;

    public Task<Charge?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        OrgQuery().FirstOrDefaultAsync(c => c.Id == id, ct);

    public Task<Charge?> GetByReferenceIdAsync(string referenceId, CancellationToken ct = default) =>
        OrgQuery().FirstOrDefaultAsync(c => c.ReferenceId == referenceId, ct);

    public Task<Charge?> GetByExternalIdAsync(string externalId, CancellationToken ct = default) =>
        OrgQuery().FirstOrDefaultAsync(c => c.ExternalId == externalId, ct);

    public Task<int> CountByDateAsync(DateTime date, CancellationToken ct = default)
    {
        var start = date.Date.ToUniversalTime();
        var end   = start.AddDays(1);
        return OrgQuery().CountAsync(c => c.CreatedAt >= start && c.CreatedAt < end, ct);
    }

    public async Task AddAsync(Charge charge, CancellationToken ct = default)
    {
        await db.Charges.AddAsync(charge, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Charge charge, CancellationToken ct = default)
    {
        db.Charges.Update(charge);
        await db.SaveChangesAsync(ct);
    }

    public Task<List<Charge>> GetExpiredPendingAsync(CancellationToken ct = default) =>
        OrgQuery()
           .Where(c => c.Status == ChargeStatus.Pending && c.ExpiresAt < DateTime.UtcNow)
           .ToListAsync(ct);

    public async Task<PagedResult<Charge>> ListAsync(
        ChargeStatus? status,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = OrgQuery();

        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);
        if (fromDate.HasValue)
            query = query.Where(c => c.CreatedAt >= fromDate.Value.ToUniversalTime());
        if (toDate.HasValue)
            query = query.Where(c => c.CreatedAt < toDate.Value.ToUniversalTime().AddDays(1));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<Charge> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }
}
