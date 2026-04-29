using Microsoft.EntityFrameworkCore;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Repositories;

public sealed class ReconciliationRepository : IReconciliationRepository
{
    private readonly RecixDbContext _db;

    public ReconciliationRepository(RecixDbContext db) => _db = db;

    public Task<ReconciliationResult?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _db.ReconciliationResults.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task AddAsync(ReconciliationResult result, CancellationToken cancellationToken = default)
    {
        await _db.ReconciliationResults.AddAsync(result, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResult<ReconciliationResult>> ListAsync(
        ReconciliationStatus? status,
        Guid? chargeId,
        Guid? paymentEventId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.ReconciliationResults.AsQueryable();

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        if (chargeId.HasValue)
            query = query.Where(r => r.ChargeId == chargeId.Value);

        if (paymentEventId.HasValue)
            query = query.Where(r => r.PaymentEventId == paymentEventId.Value);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<ReconciliationResult>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }
}
