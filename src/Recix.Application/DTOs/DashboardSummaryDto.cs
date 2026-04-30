namespace Recix.Application.DTOs;

public sealed class DashboardSummaryDto
{
    public int TotalCharges { get; init; }
    public int PaidCharges { get; init; }
    public int PendingCharges { get; init; }
    public int DivergentCharges { get; init; }
    public int ExpiredCharges { get; init; }
    public decimal TotalReceivedAmount { get; init; }
    public decimal TotalDivergentAmount { get; init; }
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
