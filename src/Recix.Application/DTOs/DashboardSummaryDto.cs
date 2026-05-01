namespace Recix.Application.DTOs;

public sealed class DashboardSummaryDto
{
    public int TotalCharges { get; init; }
    public int PaidCharges { get; init; }
    public int PendingCharges { get; init; }
    public int DivergentCharges { get; init; }
    public int ExpiredCharges { get; init; }
    public decimal TotalReceivedAmount { get; init; }

    /// <summary>Soma das cobranças marcadas como divergentes no período.</summary>
    public decimal TotalDivergentAmount { get; init; }

    /// <summary>
    /// Exposição monetária a partir das conciliações problemáticas (valor divergente, pagamento sem cobrança, duplicado, etc.).
    /// Pode ser &gt; 0 mesmo quando <see cref="TotalDivergentAmount"/> é zero.
    /// </summary>
    public decimal TotalReconciliationAttentionAmount { get; init; }

    public ReconciliationIssuesDto ReconciliationIssues { get; init; } = new();
}

public sealed class ReconciliationIssuesDto
{
    public int Matched { get; init; }
    public int AmountMismatch { get; init; }
    public int DuplicatePayment { get; init; }
    public int PaymentWithoutCharge { get; init; }
    public int ExpiredChargePaid { get; init; }
    public int InvalidReference { get; init; }
    public int ProcessingError { get; init; }
}
