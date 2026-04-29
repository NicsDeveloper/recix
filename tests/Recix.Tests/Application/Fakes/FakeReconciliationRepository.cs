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

    public IReadOnlyList<ReconciliationResult> All => _store;
}
