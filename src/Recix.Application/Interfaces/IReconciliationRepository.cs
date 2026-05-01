using Recix.Application.DTOs;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Interfaces;

public interface IReconciliationRepository
{
    Task<ReconciliationResult?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(ReconciliationResult result, CancellationToken cancellationToken = default);
    Task<PagedResult<ReconciliationResult>> ListAsync(
        ReconciliationStatus? status,
        Guid? chargeId,
        Guid? paymentEventId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ReconciliationResult>> GetByStatusAndOrganizationAsync(
        ReconciliationStatus status,
        Guid organizationId,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
