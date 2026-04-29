namespace Recix.Application.DTOs;

public sealed class CreateChargeRequest
{
    public decimal Amount { get; init; }
    public int ExpiresInMinutes { get; init; }
}
