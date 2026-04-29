using Recix.Domain.Entities;

namespace Recix.Application.DTOs;

public sealed class ChargeDto
{
    public Guid Id { get; init; }
    public string ReferenceId { get; init; } = default!;
    public string ExternalId { get; init; } = default!;
    public decimal Amount { get; init; }
    public string Status { get; init; } = default!;
    public DateTime ExpiresAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }

    public static ChargeDto FromEntity(Charge c) => new()
    {
        Id = c.Id,
        ReferenceId = c.ReferenceId,
        ExternalId = c.ExternalId,
        Amount = c.Amount,
        Status = c.Status.ToString(),
        ExpiresAt = c.ExpiresAt,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt
    };
}
