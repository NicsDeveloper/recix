using Microsoft.EntityFrameworkCore;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Repositories;

public sealed class ReconciliationRepository(RecixDbContext db, ICurrentOrganization currentOrg) : IReconciliationRepository
{
    private IQueryable<ReconciliationResult> OrgQuery() =>
        currentOrg.OrganizationId.HasValue
            ? db.ReconciliationResults.Where(r => r.OrganizationId == currentOrg.OrganizationId.Value)
            : db.ReconciliationResults;

    public Task<ReconciliationResult?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        OrgQuery().FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task AddAsync(ReconciliationResult result, CancellationToken ct = default)
    {
        await db.ReconciliationResults.AddAsync(result, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<ReconciliationResult>> ListAsync(
        ReconciliationStatus? status,
        Guid? chargeId,
        Guid? paymentEventId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = OrgQuery();

        if (status.HasValue)       query = query.Where(r => r.Status == status.Value);
        if (chargeId.HasValue)     query = query.Where(r => r.ChargeId == chargeId.Value);
        if (paymentEventId.HasValue) query = query.Where(r => r.PaymentEventId == paymentEventId.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<ReconciliationResult> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<IReadOnlyList<ReconciliationResult>> GetByStatusAndOrganizationAsync(
        ReconciliationStatus status, Guid organizationId, CancellationToken ct = default) =>
        await db.ReconciliationResults
            .Where(r => r.OrganizationId == organizationId && r.Status == status)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(ct);

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.ReconciliationResults.FindAsync([id], ct);
        if (entity is not null)
        {
            db.ReconciliationResults.Remove(entity);
            await db.SaveChangesAsync(ct);
        }
    }
}
