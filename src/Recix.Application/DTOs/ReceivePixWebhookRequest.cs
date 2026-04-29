namespace Recix.Application.DTOs;

public sealed class ReceivePixWebhookRequest
{
    public string EventId { get; init; } = default!;
    public string? ExternalChargeId { get; init; }
    public string? ReferenceId { get; init; }
    public decimal PaidAmount { get; init; }
    public DateTime PaidAt { get; init; }
    public string Provider { get; init; } = default!;
}
