using Recix.Domain.Enums;
using Recix.Domain.Exceptions;

namespace Recix.Domain.Entities;

public sealed class Charge
{
    public Guid Id { get; private set; }
    public string ReferenceId { get; private set; } = default!;
    public string ExternalId { get; private set; } = default!;
    public decimal Amount { get; private set; }
    public ChargeStatus Status { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private Charge() { }

    public static Charge Create(string referenceId, string externalId, decimal amount, DateTime expiresAt)
    {
        if (amount <= 0)
            throw new DomainException("Charge amount must be greater than zero.");

        if (expiresAt <= DateTime.UtcNow)
            throw new DomainException("Charge expiration must be in the future.");

        return new Charge
        {
            Id = Guid.NewGuid(),
            ReferenceId = referenceId,
            ExternalId = externalId,
            Amount = amount,
            Status = ChargeStatus.Pending,
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow
        };
    }

    public bool IsExpired() => DateTime.UtcNow > ExpiresAt;

    public bool CanReceivePayment() => Status == ChargeStatus.Pending;

    public void MarkAsPaid()
    {
        if (Status != ChargeStatus.Pending)
            throw new DomainException($"Cannot mark a {Status} charge as Paid.");

        Status = ChargeStatus.Paid;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsDivergent()
    {
        if (Status != ChargeStatus.Pending && Status != ChargeStatus.Expired)
            throw new DomainException($"Cannot mark a {Status} charge as Divergent.");

        Status = ChargeStatus.Divergent;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsExpired()
    {
        if (Status != ChargeStatus.Pending)
            throw new DomainException($"Cannot mark a {Status} charge as Expired.");

        Status = ChargeStatus.Expired;
        UpdatedAt = DateTime.UtcNow;
    }
}
