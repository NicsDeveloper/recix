namespace Recix.Application.DTOs;

public sealed class AlertConfigDto
{
    public string? WebhookUrl                { get; init; }
    public bool    NotifyAmountMismatch      { get; init; }
    public bool    NotifyDuplicatePayment    { get; init; }
    public bool    NotifyPaymentWithoutCharge { get; init; }
    public bool    NotifyExpiredChargePaid   { get; init; }
    public DateTime UpdatedAt               { get; init; }
}

public sealed class UpdateAlertConfigRequest
{
    public string? WebhookUrl                { get; init; }
    public bool    NotifyAmountMismatch      { get; init; }
    public bool    NotifyDuplicatePayment    { get; init; }
    public bool    NotifyPaymentWithoutCharge { get; init; }
    public bool    NotifyExpiredChargePaid   { get; init; }
}
