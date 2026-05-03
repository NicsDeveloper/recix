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

    /// <summary>Todos os resultados de conciliação ligados a qualquer uma das cobranças indicadas (escopo da org atual).</summary>
    Task<IReadOnlyList<ReconciliationResult>> ListByChargeIdsAsync(
        IReadOnlyList<Guid> chargeIds,
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

    /// <summary>
    /// Lista pendentes de revisão com dados da cobrança e do pagamento para exibição na UI (uma consulta).
    /// </summary>
    Task<IReadOnlyList<PendingReviewItemDto>> ListPendingReviewDtosAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default);

    /// <summary>Conta quantos resultados estão pendentes de revisão na organização.</summary>
    Task<int> CountPendingReviewAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>Verifica se uma cobrança já tem algum ReconciliationResult associado.</summary>
    Task<bool> HasReconciliationForChargeAsync(Guid chargeId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Soma os valores de pagamentos já contabilizados para a cobrança (Matched, PartialPayment,
    /// AmountMismatch parcial legado, MatchedLowConfidence confirmado).
    /// </summary>
    Task<decimal> SumAllocatedTowardChargeAsync(Guid chargeId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Descarta revisões pendentes na cobrança quando um match por identificador exato assume o processamento.
    /// </summary>
    Task AbandonPendingReviewForChargeAsync(Guid chargeId, CancellationToken cancellationToken = default);
}
