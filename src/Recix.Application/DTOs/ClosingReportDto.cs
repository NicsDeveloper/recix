namespace Recix.Application.DTOs;

public sealed class ClosingReportDto
{
    public DateTime From { get; init; }
    public DateTime To   { get; init; }

    // ── Cobranças ─────────────────────────────────────────────────────────────
    public int     TotalCharges      { get; init; }
    public int     PaidCharges       { get; init; }
    public int     PendingCharges    { get; init; }
    public int     DivergentCharges  { get; init; }
    public int     ExpiredCharges    { get; init; }

    // ── Financeiro ────────────────────────────────────────────────────────────
    public decimal ExpectedAmount    { get; init; }
    public decimal ReceivedAmount    { get; init; }
    public decimal DivergentAmount   { get; init; }
    public decimal PendingAmount     { get; init; }

    /// <summary>ReceivedAmount / ExpectedAmount × 100 (0–100)</summary>
    public decimal RecoveryRate      { get; init; }

    // ── Conciliações ──────────────────────────────────────────────────────────
    public int ReconciliationsTotal                { get; init; }
    public int ReconciliationsMatched              { get; init; }
    public int ReconciliationsMatchedLowConfidence { get; init; }
    public int ReconciliationsAmountMismatch       { get; init; }
    public int ReconciliationsPartialPayment       { get; init; }
    public int ReconciliationsPaymentExceedsExpected { get; init; }
    public int ReconciliationsDuplicate            { get; init; }
    public int ReconciliationsNoCharge             { get; init; }
    public int ReconciliationsChargeWithoutPayment { get; init; }
    public int ReconciliationsMultipleMatch        { get; init; }
    public int ReconciliationsExpiredPaid          { get; init; }
    public int ReconciliationsInvalidRef           { get; init; }
    public int ReconciliationsError                { get; init; }

    // ── Cobranças não conciliadas ─────────────────────────────────────────────
    public IReadOnlyList<UnreconciledChargeDto> Unreconciled { get; init; } = [];

    public DateTime GeneratedAt { get; init; } = DateTime.UtcNow;
}

public sealed class UnreconciledChargeDto
{
    public Guid    Id          { get; init; }
    public string  ReferenceId { get; init; } = "";
    public decimal Amount      { get; init; }
    public string  Status      { get; init; } = "";
    public DateTime ExpiresAt  { get; init; }
    public DateTime CreatedAt  { get; init; }
}
