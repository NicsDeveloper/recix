using Recix.Application.DTOs;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Interfaces;

public interface IPaymentEventRepository
{
    Task<PaymentEvent?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PaymentEvent?> GetByEventIdAsync(string eventId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentEvent>> GetByStatusAsync(PaymentEventStatus status, int batchSize, CancellationToken cancellationToken = default);
    Task AddAsync(PaymentEvent paymentEvent, CancellationToken cancellationToken = default);
    Task UpdateAsync(PaymentEvent paymentEvent, CancellationToken cancellationToken = default);
    Task<PagedResult<PaymentEvent>> ListAsync(
        PaymentEventStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
