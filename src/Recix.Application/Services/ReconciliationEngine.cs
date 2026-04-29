using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

public sealed record ReconciliationOutcome(ReconciliationResult Result, Charge? Charge);

public sealed class ReconciliationEngine
{
    private readonly IChargeRepository _charges;

    public ReconciliationEngine(IChargeRepository charges) => _charges = charges;

    public async Task<ReconciliationOutcome> ReconcileAsync(PaymentEvent paymentEvent, CancellationToken cancellationToken = default)
    {
        // InvalidReference: neither identifier provided (domain-model.md §Regras de Conciliação)
        if (string.IsNullOrWhiteSpace(paymentEvent.ExternalChargeId) &&
            string.IsNullOrWhiteSpace(paymentEvent.ReferenceId))
        {
            var result = ReconciliationResult.Create(
                paymentEvent.OrganizationId,
                null, paymentEvent.Id,
                ReconciliationStatus.InvalidReference,
                "Payment event has neither ExternalChargeId nor ReferenceId.",
                null, paymentEvent.PaidAmount);

            return new ReconciliationOutcome(result, null);
        }

        var charge = await FindChargeAsync(paymentEvent, cancellationToken);

        if (charge is null)
        {
            var result = ReconciliationResult.Create(
                paymentEvent.OrganizationId,
                null, paymentEvent.Id,
                ReconciliationStatus.PaymentWithoutCharge,
                "No charge found matching ExternalChargeId or ReferenceId.",
                null, paymentEvent.PaidAmount);

            return new ReconciliationOutcome(result, null);
        }

        var orgId = paymentEvent.OrganizationId;

        // Duplicate: charge already settled
        if (charge.Status == ChargeStatus.Paid || charge.Status == ChargeStatus.Divergent)
        {
            var result = ReconciliationResult.Create(
                orgId, charge.Id, paymentEvent.Id,
                ReconciliationStatus.DuplicatePayment,
                $"Charge is already in status {charge.Status}. Duplicate payment ignored.",
                charge.Amount, paymentEvent.PaidAmount);

            return new ReconciliationOutcome(result, null);
        }

        // Expired charge (takes priority over amount check)
        if (charge.IsExpired())
        {
            charge.MarkAsDivergent();
            var result = ReconciliationResult.Create(
                orgId, charge.Id, paymentEvent.Id,
                ReconciliationStatus.ExpiredChargePaid,
                $"Charge expired at {charge.ExpiresAt:O}. Payment received after expiration.",
                charge.Amount, paymentEvent.PaidAmount);

            return new ReconciliationOutcome(result, charge);
        }

        // Amount mismatch
        if (paymentEvent.PaidAmount != charge.Amount)
        {
            charge.MarkAsDivergent();
            var result = ReconciliationResult.Create(
                orgId, charge.Id, paymentEvent.Id,
                ReconciliationStatus.AmountMismatch,
                $"Paid amount {paymentEvent.PaidAmount:F2} differs from expected {charge.Amount:F2}.",
                charge.Amount, paymentEvent.PaidAmount);

            return new ReconciliationOutcome(result, charge);
        }

        // Happy path: matched
        charge.MarkAsPaid();
        var matched = ReconciliationResult.Create(
            orgId, charge.Id, paymentEvent.Id,
            ReconciliationStatus.Matched,
            "Payment matched successfully.",
            charge.Amount, paymentEvent.PaidAmount);

        return new ReconciliationOutcome(matched, charge);
    }

    private async Task<Charge?> FindChargeAsync(PaymentEvent paymentEvent, CancellationToken cancellationToken)
    {
        Charge? charge = null;

        if (!string.IsNullOrWhiteSpace(paymentEvent.ExternalChargeId))
            charge = await _charges.GetByExternalIdAsync(paymentEvent.ExternalChargeId, cancellationToken);

        if (charge is null && !string.IsNullOrWhiteSpace(paymentEvent.ReferenceId))
            charge = await _charges.GetByReferenceIdAsync(paymentEvent.ReferenceId, cancellationToken);

        return charge;
    }
}
