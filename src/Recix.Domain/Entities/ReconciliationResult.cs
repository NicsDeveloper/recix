using Recix.Domain.Enums;

namespace Recix.Domain.Entities;

public sealed class ReconciliationResult
{
    public Guid  Id             { get; private set; }
    public Guid  OrganizationId { get; private set; }
    public Guid? ChargeId       { get; private set; }
    public Guid PaymentEventId { get; private set; }
    public ReconciliationStatus Status { get; private set; }
    public string Reason { get; private set; } = default!;
    public decimal? ExpectedAmount { get; private set; }
    public decimal PaidAmount { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private ReconciliationResult() { }

    public static ReconciliationResult Create(
        Guid organizationId,
        Guid? chargeId,
        Guid paymentEventId,
        ReconciliationStatus status,
        string reason,
        decimal? expectedAmount,
        decimal paidAmount)
    {
        return new ReconciliationResult
        {
            Id             = Guid.NewGuid(),
            OrganizationId = organizationId,
            ChargeId       = chargeId,
            PaymentEventId = paymentEventId,
            Status = status,
            Reason = reason,
            ExpectedAmount = expectedAmount,
            PaidAmount = paidAmount,
            CreatedAt = DateTime.UtcNow
        };
    }
}
