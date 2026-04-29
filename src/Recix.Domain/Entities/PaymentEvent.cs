using Recix.Domain.Enums;
using Recix.Domain.Exceptions;

namespace Recix.Domain.Entities;

public sealed class PaymentEvent
{
    public Guid Id             { get; private set; }
    public Guid OrganizationId { get; private set; }
    public string EventId      { get; private set; } = default!;
    public string? ExternalChargeId { get; private set; }
    public string? ReferenceId { get; private set; }
    public decimal PaidAmount { get; private set; }
    public DateTime PaidAt { get; private set; }
    public string Provider { get; private set; } = default!;
    public string RawPayload { get; private set; } = default!;
    public PaymentEventStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? ProcessedAt { get; private set; }

    private PaymentEvent() { }

    public static PaymentEvent Create(
        Guid organizationId,
        string eventId,
        string? externalChargeId,
        string? referenceId,
        decimal paidAmount,
        DateTime paidAt,
        string provider,
        string rawPayload)
    {
        if (paidAmount <= 0)
            throw new DomainException("PaidAmount must be greater than zero.");

        return new PaymentEvent
        {
            Id             = Guid.NewGuid(),
            OrganizationId = organizationId,
            EventId        = eventId,
            ExternalChargeId = externalChargeId,
            ReferenceId = referenceId,
            PaidAmount = paidAmount,
            PaidAt = paidAt,
            Provider = provider,
            RawPayload = rawPayload,
            Status = PaymentEventStatus.Received,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void MarkAsProcessing()
    {
        if (Status != PaymentEventStatus.Received)
            throw new DomainException($"Cannot mark a {Status} event as Processing.");

        Status = PaymentEventStatus.Processing;
    }

    public void MarkAsProcessed()
    {
        if (Status != PaymentEventStatus.Processing)
            throw new DomainException($"Cannot mark a {Status} event as Processed.");

        Status = PaymentEventStatus.Processed;
        ProcessedAt = DateTime.UtcNow;
    }

    public void MarkAsFailed()
    {
        Status = PaymentEventStatus.Failed;
        ProcessedAt = DateTime.UtcNow;
    }

    public void MarkAsIgnoredDuplicate()
    {
        Status = PaymentEventStatus.IgnoredDuplicate;
    }

    public void RequeueForRetry()
    {
        if (Status != PaymentEventStatus.Failed)
            throw new DomainException($"Cannot requeue a {Status} event for retry.");

        Status = PaymentEventStatus.Received;
        ProcessedAt = null;
    }
}
