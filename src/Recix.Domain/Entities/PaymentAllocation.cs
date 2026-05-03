using Recix.Domain.Enums;
using Recix.Domain.Exceptions;

namespace Recix.Domain.Entities;

/// <summary>
/// Valor de um evento de pagamento aplicado a uma cobrança — fonte de verdade do saldo reconhecido.
/// </summary>
public sealed class PaymentAllocation
{
    public Guid Id { get; private set; }
    public Guid OrganizationId { get; private set; }
    public Guid ChargeId { get; private set; }
    public Guid PaymentEventId { get; private set; }
    public decimal Amount { get; private set; }
    public AllocationRecognition Recognition { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? VoidedAt { get; private set; }

    private PaymentAllocation() { }

    public static PaymentAllocation CreateRecognized(
        Guid organizationId,
        Guid chargeId,
        Guid paymentEventId,
        decimal amount)
    {
        if (paymentEventId == Guid.Empty)
            throw new DomainException("PaymentEventId is required for a payment allocation.");
        if (amount <= 0)
            throw new DomainException("Allocation amount must be greater than zero.");

        return new PaymentAllocation
        {
            Id             = Guid.NewGuid(),
            OrganizationId = organizationId,
            ChargeId       = chargeId,
            PaymentEventId = paymentEventId,
            Amount         = amount,
            Recognition    = AllocationRecognition.Recognized,
            CreatedAt      = DateTime.UtcNow,
            VoidedAt       = null,
        };
    }
}
