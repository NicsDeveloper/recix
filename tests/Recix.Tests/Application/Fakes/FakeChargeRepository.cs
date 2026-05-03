using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Tests.Application.Fakes;

public sealed class FakeChargeRepository : IChargeRepository
{
    private readonly List<Charge> _store = [];

    public Task<Charge?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        Task.FromResult(_store.FirstOrDefault(c => c.Id == id));

    public Task<List<Charge>> GetByIdsAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default) =>
        Task.FromResult(_store.Where(c => ids.Contains(c.Id)).ToList());

    public Task<Charge?> GetByReferenceIdAsync(string referenceId, CancellationToken ct = default) =>
        Task.FromResult(_store.FirstOrDefault(c => c.ReferenceId == referenceId));

    public Task<Charge?> GetByExternalIdAsync(string externalId, CancellationToken ct = default) =>
        Task.FromResult(_store.FirstOrDefault(c => c.ExternalId == externalId));

    public Task<int> CountByDateAsync(DateTime date, CancellationToken ct = default) =>
        Task.FromResult(_store.Count(c => c.CreatedAt.Date == date.Date));

    public Task AddAsync(Charge charge, CancellationToken ct = default)
    {
        _store.Add(charge);
        return Task.CompletedTask;
    }

    public Task UpdateAsync(Charge charge, CancellationToken ct = default) =>
        Task.CompletedTask;

    public Task<PagedResult<Charge>> ListAsync(ChargeStatus? status, DateTime? fromDate, DateTime? toDate, int page, int pageSize, CancellationToken ct = default) =>
        Task.FromResult(new PagedResult<Charge> { Items = _store.ToList(), TotalCount = _store.Count, Page = page, PageSize = pageSize });

    public Task<List<Charge>> GetExpiredPendingAsync(CancellationToken ct = default) =>
        Task.FromResult(_store.Where(c => c.Status == ChargeStatus.Pending && c.ExpiresAt < DateTime.UtcNow).ToList());

    public Task<List<Charge>> FindPendingByAmountAsync(decimal amount, Guid organizationId, CancellationToken ct = default) =>
        Task.FromResult(_store
            .Where(c => c.Status == ChargeStatus.Pending && c.Amount == amount && c.OrganizationId == organizationId)
            .OrderBy(c => c.CreatedAt)
            .ToList());

    public Task<List<Charge>> FindPendingByAmountAndDateRangeAsync(decimal amount, Guid organizationId, DateTime from, DateTime to, CancellationToken ct = default) =>
        Task.FromResult(_store
            .Where(c => c.Status == ChargeStatus.Pending
                     && c.Amount == amount
                     && c.OrganizationId == organizationId
                     && c.CreatedAt >= from
                     && c.CreatedAt <= to)
            .OrderBy(c => c.CreatedAt)
            .ToList());

    public Task<List<Charge>> GetExpiredWithoutReconciliationAsync(CancellationToken ct = default) =>
        Task.FromResult(_store.Where(c => c.Status == ChargeStatus.Expired).ToList());

    public IReadOnlyList<Charge> All => _store;
}
