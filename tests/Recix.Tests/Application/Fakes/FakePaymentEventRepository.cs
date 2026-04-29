using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Tests.Application.Fakes;

public sealed class FakePaymentEventRepository : IPaymentEventRepository
{
    private readonly List<PaymentEvent> _store = [];

    public Task<PaymentEvent?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        Task.FromResult(_store.FirstOrDefault(e => e.Id == id));

    public Task<PaymentEvent?> GetByEventIdAsync(string eventId, CancellationToken ct = default) =>
        Task.FromResult(_store.FirstOrDefault(e => e.EventId == eventId));

    public Task<IReadOnlyList<PaymentEvent>> GetByStatusAsync(PaymentEventStatus status, int batchSize, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<PaymentEvent>>(_store.Where(e => e.Status == status).Take(batchSize).ToList());

    public Task AddAsync(PaymentEvent paymentEvent, CancellationToken ct = default)
    {
        _store.Add(paymentEvent);
        return Task.CompletedTask;
    }

    public Task UpdateAsync(PaymentEvent paymentEvent, CancellationToken ct = default) =>
        Task.CompletedTask;

    public Task<PagedResult<PaymentEvent>> ListAsync(PaymentEventStatus? status, int page, int pageSize, CancellationToken ct = default) =>
        Task.FromResult(new PagedResult<PaymentEvent> { Items = _store.ToList(), TotalCount = _store.Count, Page = page, PageSize = pageSize });

    public IReadOnlyList<PaymentEvent> All => _store;
}
