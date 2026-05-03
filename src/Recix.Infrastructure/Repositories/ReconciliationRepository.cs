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

    public async Task UpdateAsync(ReconciliationResult result, CancellationToken ct = default)
    {
        db.ReconciliationResults.Update(result);
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.ReconciliationResults.FindAsync([id], ct);
        if (entity is not null)
        {
            db.ReconciliationResults.Remove(entity);
            await db.SaveChangesAsync(ct);
        }
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

        if (status.HasValue)         query = query.Where(r => r.Status == status.Value);
        if (chargeId.HasValue)       query = query.Where(r => r.ChargeId == chargeId.Value);
        if (paymentEventId.HasValue) query = query.Where(r => r.PaymentEventId == paymentEventId.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<ReconciliationResult> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<IReadOnlyList<ReconciliationResult>> ListByChargeIdsAsync(
        IReadOnlyList<Guid> chargeIds,
        CancellationToken ct = default)
    {
        if (chargeIds.Count == 0)
            return [];

        return await OrgQuery()
            .Where(r => r.ChargeId.HasValue && chargeIds.Contains(r.ChargeId.Value))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<ReconciliationResult>> GetByStatusAndOrganizationAsync(
        ReconciliationStatus status, Guid organizationId, CancellationToken ct = default) =>
        await db.ReconciliationResults
            .Where(r => r.OrganizationId == organizationId && r.Status == status)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ReconciliationResult>> GetPendingReviewAsync(
        Guid organizationId, CancellationToken ct = default) =>
        await db.ReconciliationResults
            .Where(r => r.OrganizationId == organizationId
                     && r.RequiresReview
                     && r.ReviewDecision == null)
            .OrderByDescending(r => r.PaidAmount)  // maior impacto financeiro primeiro
            .ToListAsync(ct);

    public async Task<IReadOnlyList<PendingReviewItemDto>> ListPendingReviewDtosAsync(
        Guid organizationId, CancellationToken ct = default)
    {
        var q =
            from r in db.ReconciliationResults
            where r.OrganizationId == organizationId
                  && r.RequiresReview
                  && r.ReviewDecision == null
            join c in db.Charges on r.ChargeId equals c.Id into cj
            from c in cj.DefaultIfEmpty()
            join p in db.PaymentEvents on r.PaymentEventId equals p.Id into pj
            from p in pj.DefaultIfEmpty()
            orderby r.PaidAmount descending
            select new PendingReviewItemDto
            {
                Id                   = r.Id,
                Status               = r.Status.ToString(),
                Confidence           = r.Confidence.ToString(),
                MatchReason          = r.MatchReason.ToString(),
                MatchedField         = r.MatchedField,
                Reason               = r.Reason,
                ChargeId             = r.ChargeId,
                PaymentEventId       = r.PaymentEventId == Guid.Empty ? null : r.PaymentEventId,
                ExpectedAmount       = r.ExpectedAmount,
                PaidAmount           = r.PaidAmount,
                CreatedAt            = r.CreatedAt,
                ChargeReferenceId    = c != null ? c.ReferenceId : null,
                ChargeExternalId     = c != null ? c.ExternalId : null,
                PaymentTransactionId = p != null ? p.EventId : null,
                PaymentReferenceId   = p != null ? p.ReferenceId : null,
                PaymentProvider      = p != null ? p.Provider : null,
                PaymentPaidAt        = p != null ? p.PaidAt : null,
            };

        return await q.ToListAsync(ct);
    }

    public Task<int> CountPendingReviewAsync(Guid organizationId, CancellationToken ct = default) =>
        db.ReconciliationResults.CountAsync(
            r => r.OrganizationId == organizationId
              && r.RequiresReview
              && r.ReviewDecision == null,
            ct);

    public Task<bool> HasReconciliationForChargeAsync(Guid chargeId, CancellationToken ct = default) =>
        db.ReconciliationResults.AnyAsync(r => r.ChargeId == chargeId, ct);

    public async Task<decimal> SumAllocatedTowardChargeAsync(Guid chargeId, CancellationToken ct = default)
    {
        // Não usa OrgQuery: o chargeId já identifica a cobrança (ex.: jobs sem escopo de org).
        return await db.ReconciliationResults
            .Where(r => r.ChargeId == chargeId && r.PaymentEventId != Guid.Empty)
            .Where(r =>
                r.Status == ReconciliationStatus.Matched
                || r.Status == ReconciliationStatus.PartialPayment
                || (r.Status == ReconciliationStatus.MatchedLowConfidence && r.ReviewDecision == "Confirmed")
                || (r.Status == ReconciliationStatus.AmountMismatch
                    && r.ExpectedAmount.HasValue
                    && r.PaidAmount < r.ExpectedAmount.Value))
            .SumAsync(r => r.PaidAmount, ct);
    }

    public async Task AbandonPendingReviewForChargeAsync(Guid chargeId, CancellationToken ct = default)
    {
        var rows = await db.ReconciliationResults
            .Where(r => r.ChargeId == chargeId && r.RequiresReview && r.ReviewDecision == null)
            .ToListAsync(ct);

        foreach (var r in rows)
        {
            r.MarkSupersededByExactIdMatch();
            db.ReconciliationResults.Update(r);
        }

        if (rows.Count > 0)
            await db.SaveChangesAsync(ct);
    }
}
