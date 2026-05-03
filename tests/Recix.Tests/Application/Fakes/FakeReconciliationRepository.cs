using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Tests.Application.Fakes;

public sealed class FakeReconciliationRepository : IReconciliationRepository
{
    private readonly List<ReconciliationResult> _store       = [];
    private readonly List<PaymentAllocation>    _allocations = [];

    public Task<ReconciliationResult?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        Task.FromResult(_store.FirstOrDefault(r => r.Id == id));

    public Task AddAsync(ReconciliationResult result, CancellationToken ct = default)
    {
        _store.Add(result);
        return Task.CompletedTask;
    }

    public Task<PagedResult<ReconciliationResult>> ListAsync(ReconciliationStatus? status, Guid? chargeId, Guid? paymentEventId, int page, int pageSize, CancellationToken ct = default) =>
        Task.FromResult(new PagedResult<ReconciliationResult> { Items = _store.ToList(), TotalCount = _store.Count, Page = page, PageSize = pageSize });

    public Task<IReadOnlyList<ReconciliationResult>> ListByChargeIdsAsync(IReadOnlyList<Guid> chargeIds, CancellationToken ct = default)
    {
        if (chargeIds.Count == 0)
            return Task.FromResult<IReadOnlyList<ReconciliationResult>>([]);

        var set = chargeIds.ToHashSet();
        var list = _store.Where(r => r.ChargeId.HasValue && set.Contains(r.ChargeId.Value))
            .OrderByDescending(r => r.CreatedAt)
            .ToList();
        return Task.FromResult<IReadOnlyList<ReconciliationResult>>(list);
    }

    public Task<IReadOnlyList<ReconciliationResult>> GetByStatusAndOrganizationAsync(ReconciliationStatus status, Guid organizationId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<ReconciliationResult>>(
            _store.Where(r => r.Status == status && r.OrganizationId == organizationId).ToList());

    public Task UpdateAsync(ReconciliationResult result, CancellationToken ct = default) =>
        Task.CompletedTask;

    public Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        _store.RemoveAll(r => r.Id == id);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<ReconciliationResult>> GetPendingReviewAsync(Guid organizationId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<ReconciliationResult>>(
            _store.Where(r => r.OrganizationId == organizationId && r.RequiresReview && r.ReviewDecision == null)
                  .OrderByDescending(r => r.PaidAmount)
                  .ToList());

    public Task<IReadOnlyList<PendingReviewItemDto>> ListPendingReviewDtosAsync(Guid organizationId, CancellationToken ct = default)
    {
        var rows = _store
            .Where(r => r.OrganizationId == organizationId && r.RequiresReview && r.ReviewDecision == null)
            .OrderByDescending(r => r.PaidAmount)
            .Select(r => new PendingReviewItemDto
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
                ChargeReferenceId    = null,
                ChargeExternalId     = null,
                PaymentTransactionId = null,
                PaymentReferenceId   = null,
                PaymentProvider      = null,
                PaymentPaidAt        = null,
            })
            .ToList();
        return Task.FromResult<IReadOnlyList<PendingReviewItemDto>>(rows);
    }

    public Task<int> CountPendingReviewAsync(Guid organizationId, CancellationToken ct = default) =>
        Task.FromResult(_store.Count(r => r.OrganizationId == organizationId && r.RequiresReview && r.ReviewDecision == null));

    public Task<bool> HasReconciliationForChargeAsync(Guid chargeId, CancellationToken ct = default) =>
        Task.FromResult(_store.Any(r => r.ChargeId == chargeId));

    public Task<decimal> SumAllocatedTowardChargeAsync(Guid chargeId, CancellationToken ct = default)
    {
        var fromAlloc = _allocations
            .Where(a => a.ChargeId == chargeId
                        && a.VoidedAt == null
                        && a.Recognition == AllocationRecognition.Recognized)
            .Sum(a => a.Amount);
        if (fromAlloc > 0m)
            return Task.FromResult(fromAlloc);

        static bool Counts(ReconciliationResult r)
        {
            if (r.PaymentEventId == Guid.Empty)
                return false;
            if (r.Status == ReconciliationStatus.Matched)
                return true;
            if (r.Status == ReconciliationStatus.PartialPayment)
                return true;
            if (r.Status == ReconciliationStatus.MatchedLowConfidence && r.ReviewDecision == "Confirmed")
                return true;
            return r.Status == ReconciliationStatus.AmountMismatch
                   && r.ExpectedAmount.HasValue
                   && r.PaidAmount < r.ExpectedAmount.Value;
        }

        var sum = _store.Where(r => r.ChargeId == chargeId).Where(Counts).Sum(r => r.PaidAmount);
        return Task.FromResult(sum);
    }

    public Task AddPaymentAllocationAsync(PaymentAllocation allocation, CancellationToken ct = default)
    {
        _allocations.Add(allocation);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyDictionary<Guid, decimal>> SumRecognizedAllocationsByChargeIdsAsync(
        IReadOnlyList<Guid> chargeIds,
        CancellationToken ct = default)
    {
        var dict = chargeIds.Distinct().ToDictionary(id => id, _ => 0m);
        foreach (var a in _allocations.Where(x => x.VoidedAt == null && x.Recognition == AllocationRecognition.Recognized))
        {
            if (dict.ContainsKey(a.ChargeId))
                dict[a.ChargeId] += a.Amount;
        }

        return Task.FromResult<IReadOnlyDictionary<Guid, decimal>>(dict);
    }

    public Task AbandonPendingReviewForChargeAsync(Guid chargeId, CancellationToken ct = default)
    {
        foreach (var r in _store.Where(r =>
                     r.ChargeId == chargeId && r.RequiresReview && r.ReviewDecision == null))
            r.MarkSupersededByExactIdMatch();

        return Task.CompletedTask;
    }

    public IReadOnlyList<ReconciliationResult> All => _store;

    public IReadOnlyList<PaymentAllocation> AllAllocations => _allocations;
}
