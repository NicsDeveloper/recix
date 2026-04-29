using Recix.Domain.Entities;

namespace Recix.Application.DTOs;

public sealed class PaymentEventDto
{
    public Guid Id { get; init; }
    public string EventId { get; init; } = default!;
    public string? ExternalChargeId { get; init; }
    public string? ReferenceId { get; init; }
    public decimal PaidAmount { get; init; }
    public DateTime PaidAt { get; init; }
    public string Provider { get; init; } = default!;
    public string Status { get; init; } = default!;
    public DateTime CreatedAt { get; init; }
    public DateTime? ProcessedAt { get; init; }

    public static PaymentEventDto FromEntity(PaymentEvent e) => new()
    {
        Id = e.Id,
        EventId = e.EventId,
        ExternalChargeId = e.ExternalChargeId,
        ReferenceId = e.ReferenceId,
        PaidAmount = e.PaidAmount,
        PaidAt = e.PaidAt,
        Provider = e.Provider,
        Status = e.Status.ToString(),
        CreatedAt = e.CreatedAt,
        ProcessedAt = e.ProcessedAt
    };
}
