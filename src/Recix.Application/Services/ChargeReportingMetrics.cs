using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

/// <summary>
/// Única definição de totais monetários por cobrança para fechamento, resumo do dashboard e outras telas.
/// Evita divergência entre fechamento e resumo do dashboard.
/// </summary>
public static class ChargeReportingMetrics
{
    public readonly record struct Rollup(
        decimal ExpectedTotal,
        decimal ReceivedFromPaidTotal,
        decimal DivergentChargeTotal,
        decimal PendingOperationalTotal);

    /// <summary>
    /// Esperado: soma dos valores das cobranças não canceladas (inclui pendente, parcial, pago).
    /// Recebido: soma apenas cobranças em status Pago.
    /// Divergente (cobrança): soma de cobranças Divergente ou Sobre-pago.
    /// Pendente (operacional): soma de Pendente, Em revisão ou Parcialmente pago.
    /// </summary>
    public static Rollup Compute(IReadOnlyList<Charge> charges)
    {
        var expected = charges.Where(c => c.Status != ChargeStatus.Cancelled).Sum(c => c.Amount);
        var received = charges.Where(c => c.Status == ChargeStatus.Paid).Sum(c => c.Amount);
        var divergent = charges
            .Where(c => c.Status is ChargeStatus.Divergent or ChargeStatus.Overpaid)
            .Sum(c => c.Amount);
        var pending = charges
            .Where(c => c.Status is ChargeStatus.Pending
                        or ChargeStatus.PendingReview
                        or ChargeStatus.PartiallyPaid)
            .Sum(c => c.Amount);

        return new Rollup(expected, received, divergent, pending);
    }
}
