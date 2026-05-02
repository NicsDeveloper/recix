using Recix.Application.DTOs;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Interfaces;

public interface IReconciliationRepository
{
    Task<ReconciliationResult?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(ReconciliationResult result, CancellationToken cancellationToken = default);
    Task UpdateAsync(ReconciliationResult result, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

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

    /// <summary>
    /// Retorna resultados que requerem revisão humana (RequiresReview = true e sem ReviewDecision),
    /// ordenados por PaidAmount decrescente (maior impacto financeiro primeiro).
    /// </summary>
    Task<IReadOnlyList<ReconciliationResult>> GetPendingReviewAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default);

    /// <summary>Conta quantos resultados estão pendentes de revisão na organização.</summary>
    Task<int> CountPendingReviewAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>Verifica se uma cobrança já tem algum ReconciliationResult associado.</summary>
    Task<bool> HasReconciliationForChargeAsync(Guid chargeId, CancellationToken cancellationToken = default);
}
