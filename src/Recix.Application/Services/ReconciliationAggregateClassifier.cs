using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

/// <summary>
/// Agrega vários <see cref="ReconciliationResult"/> da mesma cobrança num rótulo de auditoria
/// (Conciliado / Parcial / Divergente / EmRevisao / SemAlocacao).
/// </summary>
public static class ReconciliationAggregateClassifier
{
    /// <summary>Status que indicam problema de auditoria (prioridade após revisão humana pendente).</summary>
    public static readonly ReconciliationStatus[] HardDivergentStatuses =
    [
        ReconciliationStatus.AmountMismatch,
        ReconciliationStatus.PaymentExceedsExpected,
        ReconciliationStatus.DuplicatePayment,
        ReconciliationStatus.ExpiredChargePaid,
        ReconciliationStatus.InvalidReference,
        ReconciliationStatus.ProcessingError,
        ReconciliationStatus.MultipleMatchCandidates,
    ];

    /// <summary>Alinha com a soma usada pelo motor ao aplicar novos pagamentos (Matched, Partial, mismatch parcial, etc.).</summary>
    public static decimal SumAllocatedTowardCharge(IEnumerable<ReconciliationResult> rows)
    {
        return rows
            .Where(r => r.PaymentEventId != Guid.Empty)
            .Where(r =>
                r.Status == ReconciliationStatus.Matched
                || r.Status == ReconciliationStatus.PartialPayment
                || (r.Status == ReconciliationStatus.MatchedLowConfidence && r.ReviewDecision == "Confirmed")
                || (r.Status == ReconciliationStatus.AmountMismatch
                    && r.ExpectedAmount.HasValue
                    && r.PaidAmount < r.ExpectedAmount.Value))
            .Sum(r => r.PaidAmount);
    }

    /// <summary>
    /// Rótulo estável para API/UI. <paramref name="expectedAmount"/> vem da cobrança.
    /// </summary>
    public static string Classify(decimal expectedAmount, IReadOnlyList<ReconciliationResult> rows)
    {
        if (rows.Count == 0)
            return "SemAlocacao";

        if (rows.Any(r => r.RequiresReview && r.ReviewDecision is null))
            return "EmRevisao";

        if (rows.Any(r => HardDivergentStatuses.Contains(r.Status)))
            return "Divergente";

        var allocated = SumAllocatedTowardCharge(rows);

        if (allocated <= 0)
            return "SemAlocacao";

        if (allocated < expectedAmount)
            return "Parcial";

        if (allocated == expectedAmount)
            return "Conciliado";

        return "Divergente";
    }
}
