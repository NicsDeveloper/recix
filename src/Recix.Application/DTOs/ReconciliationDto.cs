using Recix.Domain.Entities;

namespace Recix.Application.DTOs;

public sealed class ReconciliationDto
{
    public Guid Id { get; init; }
    public Guid? ChargeId { get; init; }
    public Guid PaymentEventId { get; init; }
    public string Status { get; init; } = default!;
    public string Reason { get; init; } = default!;
    public decimal? ExpectedAmount { get; init; }
    public decimal PaidAmount { get; init; }
    public DateTime CreatedAt { get; init; }

    public static ReconciliationDto FromEntity(ReconciliationResult r) => new()
    {
        Id = r.Id,
        ChargeId = r.ChargeId,
        PaymentEventId = r.PaymentEventId,
        Status = r.Status.ToString(),
        Reason = r.Reason,
        ExpectedAmount = r.ExpectedAmount,
        PaidAmount = r.PaidAmount,
        CreatedAt = r.CreatedAt
    };
}
