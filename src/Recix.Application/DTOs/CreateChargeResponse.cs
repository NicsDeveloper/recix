namespace Recix.Application.DTOs;

public sealed class CreateChargeResponse
{
    public Guid Id { get; init; }
    public string ReferenceId { get; init; } = default!;
    public string ExternalId { get; init; } = default!;
    public decimal Amount { get; init; }
    public string Status { get; init; } = default!;
    public DateTime ExpiresAt { get; init; }
    public DateTime CreatedAt { get; init; }
}
