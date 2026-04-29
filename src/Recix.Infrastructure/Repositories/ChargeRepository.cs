using Microsoft.EntityFrameworkCore;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Repositories;

public sealed class ChargeRepository : IChargeRepository
{
    private readonly RecixDbContext _db;

    public ChargeRepository(RecixDbContext db) => _db = db;

    public Task<Charge?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _db.Charges.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public Task<Charge?> GetByReferenceIdAsync(string referenceId, CancellationToken cancellationToken = default) =>
        _db.Charges.FirstOrDefaultAsync(c => c.ReferenceId == referenceId, cancellationToken);

    public Task<Charge?> GetByExternalIdAsync(string externalId, CancellationToken cancellationToken = default) =>
        _db.Charges.FirstOrDefaultAsync(c => c.ExternalId == externalId, cancellationToken);

    public Task<int> CountByDateAsync(DateTime date, CancellationToken cancellationToken = default)
    {
        var start = date.Date.ToUniversalTime();
        var end = start.AddDays(1);
        return _db.Charges.CountAsync(c => c.CreatedAt >= start && c.CreatedAt < end, cancellationToken);
    }

    public async Task AddAsync(Charge charge, CancellationToken cancellationToken = default)
    {
        await _db.Charges.AddAsync(charge, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Charge charge, CancellationToken cancellationToken = default)
    {
        _db.Charges.Update(charge);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResult<Charge>> ListAsync(
        ChargeStatus? status,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Charges.AsQueryable();

        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);

        if (fromDate.HasValue)
            query = query.Where(c => c.CreatedAt >= fromDate.Value.ToUniversalTime());

        if (toDate.HasValue)
            query = query.Where(c => c.CreatedAt < toDate.Value.ToUniversalTime().AddDays(1));

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Charge>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }
}
