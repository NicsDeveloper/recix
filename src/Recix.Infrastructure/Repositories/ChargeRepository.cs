using Microsoft.EntityFrameworkCore;
using Npgsql;
using Recix.Application.DTOs;
using Recix.Application.Exceptions;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Repositories;

public sealed class ChargeRepository(RecixDbContext db, ICurrentOrganization currentOrg) : IChargeRepository
{
    private IQueryable<Charge> OrgQuery() =>
        currentOrg.OrganizationId.HasValue
            ? db.Charges.Where(c => c.OrganizationId == currentOrg.OrganizationId.Value)
            : db.Charges;

    /// <summary>
    /// Parâmetros de data vêm em ISO UTC da API; <see cref="DateTimeKind.Unspecified"/> não deve ser tratado como hora local do servidor.
    /// </summary>
    private static DateTime AsUtcQueryInstant(DateTime dt) =>
        dt.Kind switch
        {
            DateTimeKind.Utc         => dt,
            DateTimeKind.Local       => dt.ToUniversalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
            _                        => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
        };

    public Task<Charge?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        OrgQuery().FirstOrDefaultAsync(c => c.Id == id, ct);

    public Task<List<Charge>> GetByIdsAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default)
    {
        if (ids.Count == 0)
            return Task.FromResult(new List<Charge>());
        return OrgQuery().Where(c => ids.Contains(c.Id)).ToListAsync(ct);
    }

    public Task<Charge?> GetByReferenceIdAsync(string referenceId, CancellationToken ct = default) =>
        OrgQuery().FirstOrDefaultAsync(c => c.ReferenceId == referenceId, ct);

    public Task<Charge?> GetByExternalIdAsync(string externalId, CancellationToken ct = default) =>
        OrgQuery().FirstOrDefaultAsync(c => c.ExternalId == externalId, ct);

    public Task<int> CountByDateAsync(DateTime date, CancellationToken ct = default)
    {
        var start = date.Date.ToUniversalTime();
        var end   = start.AddDays(1);
        // reference_id é único globalmente; a sequência diária deve ser global
        // para evitar colisões entre organizações diferentes.
        return db.Charges.CountAsync(c => c.CreatedAt >= start && c.CreatedAt < end, ct);
    }

    public async Task AddAsync(Charge charge, CancellationToken ct = default)
    {
        await db.Charges.AddAsync(charge, ct);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
            when (ex.InnerException is PostgresException { SqlState: "23505", ConstraintName: "ix_charges_reference_id" })
        {
            db.Entry(charge).State = EntityState.Detached;
            throw new DuplicateChargeReferenceException(charge.ReferenceId, ex);
        }
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

    public Task<List<Charge>> FindPendingByAmountAsync(
        decimal amount, Guid organizationId, CancellationToken ct = default) =>
        db.Charges
          .Where(c => c.OrganizationId == organizationId
                   && (c.Status == ChargeStatus.Pending
                       || c.Status == ChargeStatus.PartiallyPaid
                       || c.Status == ChargeStatus.Divergent)
                   && c.Amount == amount)
          .OrderBy(c => c.CreatedAt)
          .ToListAsync(ct);

    public Task<List<Charge>> FindPendingByAmountAndDateRangeAsync(
        decimal amount,
        Guid organizationId,
        DateTime from,
        DateTime to,
        CancellationToken ct = default) =>
        db.Charges
          .Where(c => c.OrganizationId == organizationId
                   && (c.Status == ChargeStatus.Pending
                       || c.Status == ChargeStatus.PartiallyPaid
                       || c.Status == ChargeStatus.Divergent)
                   && c.Amount == amount
                   && c.CreatedAt >= from
                   && c.CreatedAt <= to)
          .OrderBy(c => c.CreatedAt)
          .ToListAsync(ct);

    public Task<List<Charge>> GetExpiredWithoutReconciliationAsync(CancellationToken ct = default) =>
        OrgQuery()
          .Where(c => c.Status == ChargeStatus.Expired
                   && !db.ReconciliationResults.Any(r => r.ChargeId == c.Id))
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
            query = query.Where(c => c.CreatedAt >= AsUtcQueryInstant(fromDate.Value));
        // toDate = fim exclusivo em UTC (cliente envia meia-noite local do dia após o último dia incluso).
        if (toDate.HasValue)
            query = query.Where(c => c.CreatedAt < AsUtcQueryInstant(toDate.Value));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<Charge> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }
}
