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
    /// Retorna cobranças Pending ou PendingReview com o valor exato — FIFO sem filtro de data.
    /// Fallback de último recurso no matching.
    /// </summary>
    Task<List<Charge>> FindPendingByAmountAsync(decimal amount, Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retorna cobranças Pending com o valor exato cujo CreatedAt está dentro da janela [from, to].
    /// Preferível ao FIFO puro — maior precisão sem requerer identificador.
    /// </summary>
    Task<List<Charge>> FindPendingByAmountAndDateRangeAsync(
        decimal amount,
        Guid organizationId,
        DateTime from,
        DateTime to,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retorna cobranças Expired da organização que ainda não têm ReconciliationResult associado.
    /// Usada pelo ExpirationSweepService para gerar ChargeWithoutPayment.
    /// </summary>
    Task<List<Charge>> GetExpiredWithoutReconciliationAsync(CancellationToken cancellationToken = default);
}
