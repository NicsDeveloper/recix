using Microsoft.EntityFrameworkCore;
using Npgsql;
using Recix.Application.Exceptions;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Repositories;

public sealed class PaymentEventRepository(RecixDbContext db, ICurrentOrganization currentOrg) : IPaymentEventRepository
{
    private IQueryable<PaymentEvent> OrgQuery() =>
        currentOrg.OrganizationId.HasValue
            ? db.PaymentEvents.Where(e => e.OrganizationId == currentOrg.OrganizationId.Value)
            : db.PaymentEvents;

    public Task<PaymentEvent?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        OrgQuery().FirstOrDefaultAsync(e => e.Id == id, ct);

    // Idempotência: busca global por EventId (sem filtro de org) para detectar duplicatas entre providers
    public Task<PaymentEvent?> GetByEventIdAsync(string eventId, CancellationToken ct = default) =>
        db.PaymentEvents.FirstOrDefaultAsync(e => e.EventId == eventId, ct);

    public Task<IReadOnlyList<PaymentEvent>> GetByStatusAsync(PaymentEventStatus status, int batchSize, CancellationToken ct = default) =>
        db.PaymentEvents                         // background service: sem filtro de org
           .Where(e => e.Status == status)
           .OrderBy(e => e.CreatedAt)
           .Take(batchSize)
           .ToListAsync(ct)
           .ContinueWith<IReadOnlyList<PaymentEvent>>(t => t.Result, ct);

    public async Task AddAsync(PaymentEvent paymentEvent, CancellationToken ct = default)
    {
        try
        {
            await db.PaymentEvents.AddAsync(paymentEvent, ct);
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueEventIdViolation(ex))
        {
            throw new DuplicatePaymentEventException(paymentEvent.EventId, ex);
        }
    }

    public async Task UpdateAsync(PaymentEvent paymentEvent, CancellationToken ct = default)
    {
        db.PaymentEvents.Update(paymentEvent);
        await db.SaveChangesAsync(ct);
    }

    public async Task<int> RecoverStuckProcessingAsync(TimeSpan threshold, CancellationToken ct = default)
    {
        var deadline = DateTime.UtcNow - threshold;
        var stuck = await db.PaymentEvents
            .Where(e => e.Status == PaymentEventStatus.Processing && e.CreatedAt <= deadline)
            .ToListAsync(ct);

        if (stuck.Count == 0)
            return 0;

        foreach (var evt in stuck)
            evt.MarkAsFailed();

        await db.SaveChangesAsync(ct);
        return stuck.Count;
    }

    public async Task<PagedResult<PaymentEvent>> ListAsync(PaymentEventStatus? status, int page, int pageSize, CancellationToken ct = default)
    {
        var query = OrgQuery();
        if (status.HasValue) query = query.Where(e => e.Status == status.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<PaymentEvent> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    private static bool IsUniqueEventIdViolation(DbUpdateException ex)
    {
        if (ex.InnerException is not PostgresException pg)
            return false;

        return pg.SqlState == PostgresErrorCodes.UniqueViolation &&
               (pg.ConstraintName?.Contains("ix_payment_events_event_id", StringComparison.OrdinalIgnoreCase) ?? false);
    }
}
