using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Tests.Application.Fakes;

public sealed class FakeReconciliationRepository : IReconciliationRepository
{
    private readonly List<ReconciliationResult> _store = [];

    public Task<ReconciliationResult?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        Task.FromResult(_store.FirstOrDefault(r => r.Id == id));

    public Task AddAsync(ReconciliationResult result, CancellationToken ct = default)
    {
        _store.Add(result);
        return Task.CompletedTask;
    }

    public Task<PagedResult<ReconciliationResult>> ListAsync(ReconciliationStatus? status, Guid? chargeId, Guid? paymentEventId, int page, int pageSize, CancellationToken ct = default) =>
        Task.FromResult(new PagedResult<ReconciliationResult> { Items = _store.ToList(), TotalCount = _store.Count, Page = page, PageSize = pageSize });

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

    public Task<int> CountPendingReviewAsync(Guid organizationId, CancellationToken ct = default) =>
        Task.FromResult(_store.Count(r => r.OrganizationId == organizationId && r.RequiresReview && r.ReviewDecision == null));

    public Task<bool> HasReconciliationForChargeAsync(Guid chargeId, CancellationToken ct = default) =>
        Task.FromResult(_store.Any(r => r.ChargeId == chargeId));

    public Task<decimal> SumAllocatedTowardChargeAsync(Guid chargeId, CancellationToken ct = default)
    {
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

    public Task AbandonPendingReviewForChargeAsync(Guid chargeId, CancellationToken ct = default)
    {
        foreach (var r in _store.Where(r =>
                     r.ChargeId == chargeId && r.RequiresReview && r.ReviewDecision == null))
            r.MarkSupersededByExactIdMatch();

        return Task.CompletedTask;
    }

    public IReadOnlyList<ReconciliationResult> All => _store;
}
