namespace Recix.Application.DTOs;

public sealed class ReceivePixWebhookResponse
{
    public bool Received { get; init; }
    public string EventId { get; init; } = default!;
    public string Status { get; init; } = default!;
}
