namespace Recix.Application.DTOs;

public sealed class DashboardSummaryDto
{
    public int TotalCharges   { get; init; }
    public int PaidCharges    { get; init; }
    public int PendingCharges { get; init; }   // Pending + PendingReview
    public int DivergentCharges { get; init; }
    public int ExpiredCharges { get; init; }

    /// <summary>
    /// Soma dos valores das cobranças no período (operacional): inclui pendentes, parciais, etc.
    /// Exclui canceladas. Alinha com o valor esperado do fechamento do período.
    /// </summary>
    public decimal TotalExpectedAmount { get; init; }

    /// <summary>Soma de cobranças Paid — não inclui MatchedLowConfidence não confirmados.</summary>
    public decimal TotalReceivedAmount  { get; init; }

    /// <summary>Soma das cobranças Divergent no período.</summary>
    public decimal TotalDivergentAmount { get; init; }

    /// <summary>
    /// Exposição monetária a partir de conciliações problemáticas.
    /// Inclui ChargeWithoutPayment, MultipleMatchCandidates, etc.
    /// </summary>
    public decimal TotalReconciliationAttentionAmount { get; init; }

    /// <summary>Quantos resultados de conciliação estão pendentes de revisão humana.</summary>
    public int PendingReviewCount { get; init; }

    /// <summary>False enquanto houver conciliações aguardando revisão humana — bloqueia o fechamento do período.</summary>
    public bool PeriodCloseable => PendingReviewCount == 0;

    public ReconciliationIssuesDto ReconciliationIssues { get; init; } = new();
}

public sealed class ReconciliationIssuesDto
{
    public int Matched                { get; init; }
    public int MatchedLowConfidence   { get; init; }   // aguardando revisão
    public int AmountMismatch         { get; init; }
    public int PartialPayment         { get; init; }
    public int PaymentExceedsExpected { get; init; }
    public int DuplicatePayment       { get; init; }
    public int PaymentWithoutCharge   { get; init; }
    public int ChargeWithoutPayment   { get; init; }
    public int MultipleMatchCandidates { get; init; }
    public int ExpiredChargePaid      { get; init; }
    public int InvalidReference       { get; init; }
    public int ProcessingError        { get; init; }
}
