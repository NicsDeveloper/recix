using Microsoft.EntityFrameworkCore;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Repositories;

public sealed class PaymentEventRepository : IPaymentEventRepository
{
    private readonly RecixDbContext _db;

    public PaymentEventRepository(RecixDbContext db) => _db = db;

    public Task<PaymentEvent?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        _db.PaymentEvents.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public Task<PaymentEvent?> GetByEventIdAsync(string eventId, CancellationToken cancellationToken = default) =>
        _db.PaymentEvents.FirstOrDefaultAsync(e => e.EventId == eventId, cancellationToken);

    public async Task<IReadOnlyList<PaymentEvent>> GetByStatusAsync(
        PaymentEventStatus status,
        int batchSize,
        CancellationToken cancellationToken = default)
    {
        return await _db.PaymentEvents
            .Where(e => e.Status == status)
            .OrderBy(e => e.CreatedAt)
            .Take(batchSize)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(PaymentEvent paymentEvent, CancellationToken cancellationToken = default)
    {
        await _db.PaymentEvents.AddAsync(paymentEvent, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(PaymentEvent paymentEvent, CancellationToken cancellationToken = default)
    {
        _db.PaymentEvents.Update(paymentEvent);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResult<PaymentEvent>> ListAsync(
        PaymentEventStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.PaymentEvents.AsQueryable();

        if (status.HasValue)
            query = query.Where(e => e.Status == status.Value);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<PaymentEvent>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }
}
