using Recix.Application.DTOs;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Interfaces;

public interface IChargeRepository
{
    Task<Charge?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Charge?> GetByReferenceIdAsync(string referenceId, CancellationToken cancellationToken = default);
    Task<Charge?> GetByExternalIdAsync(string externalId, CancellationToken cancellationToken = default);
    Task<int> CountByDateAsync(DateTime date, CancellationToken cancellationToken = default);
    Task AddAsync(Charge charge, CancellationToken cancellationToken = default);
    Task UpdateAsync(Charge charge, CancellationToken cancellationToken = default);
    Task<PagedResult<Charge>> ListAsync(
        ChargeStatus? status,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>Retorna cobranças Pending cujo prazo já expirou.</summary>
    Task<List<Charge>> GetExpiredPendingAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Retorna cobranças Pending da organização com o valor exato indicado,
    /// ordenadas por CreatedAt crescente (FIFO). Usado para matching por valor
    /// quando o extrato bancário não carrega ReferenceId/ExternalChargeId.
    /// </summary>
    Task<List<Charge>> FindPendingByAmountAsync(decimal amount, Guid organizationId, CancellationToken cancellationToken = default);
}
